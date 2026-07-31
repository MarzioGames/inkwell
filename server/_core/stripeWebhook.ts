import type { Express, Request, Response } from "express";
import express from "express";
import * as db from "../db";

/**
 * Registers POST /api/stripe/webhook.
 *
 * IMPORTANT: this must be registered with express.raw({ type: 'application/json' })
 * and BEFORE the global express.json() body parser in index.ts — Stripe's
 * signature verification needs the exact raw request bytes. If express.json()
 * runs first, req.body will already be parsed and signature verification
 * will fail for every event.
 *
 * What this does NOT do (by design, needs a decision from you first):
 * - True escrow / holding funds until delivery. That requires Stripe Connect
 *   (a connected account per seller + `transfer_data` on the PaymentIntent,
 *   or a manual `stripe.transfers.create` after delivery is confirmed). Right
 *   now the full sale amount goes straight to your own Stripe account.
 * - Automatic payout to the seller. Until Connect is wired up, payouts to
 *   sellers have to happen outside Stripe (bank transfer, Pix, etc.) based on
 *   the `deliveryConfirmedAt` timestamp this webhook/flow tracks.
 */
export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
      if (!stripeSecretKey || !webhookSecret) {
        console.error("[Stripe Webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set");
        res.status(500).json({ error: "Stripe webhook not configured" });
        return;
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-07-29.dahlia" });

      const signature = req.headers["stripe-signature"];
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, signature as string, webhookSecret);
      } catch (err) {
        console.error("[Stripe Webhook] Signature verification failed:", err);
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as { id: string; metadata?: Record<string, string> };
            await handleCheckoutCompleted(session.id, session.metadata ?? {});
            break;
          }
          case "checkout.session.expired": {
            const session = event.data.object as { id: string };
            await db.updateCheckoutSessionStatus(session.id, "expired");
            break;
          }
          // Stripe retries on non-2xx, so unhandled event types still return 200.
          default:
            break;
        }
        res.json({ received: true });
      } catch (err) {
        console.error("[Stripe Webhook] Handler error:", err);
        // 500 tells Stripe to retry the event later.
        res.status(500).json({ error: "Webhook handler failed" });
      }
    }
  );
}

async function handleCheckoutCompleted(stripeSessionId: string, metadata: Record<string, string>) {
  const localSession = await db.getCheckoutSessionByStripeId(stripeSessionId);
  if (!localSession) {
    console.error(`[Stripe Webhook] No local checkout session found for ${stripeSessionId}`);
    return;
  }
  // Idempotency: Stripe can deliver the same event more than once.
  if (localSession.status === "completed") return;

  await db.updateCheckoutSessionStatus(stripeSessionId, "completed");

  const listingId = Number(metadata.listing_id) || localSession.listingId;
  const listing = await db.getListingById(listingId);
  if (listing && listing.status === "active") {
    await db.updateListing(listingId, { status: "sold" });
    await db.createNotification({
      userId: listing.authorId,
      type: "listing_sold",
      title: "Seu livro foi vendido! 🎉",
      body: `"${listing.bookTitle}" foi comprado. Combine a entrega com o comprador pelo chat.`,
      link: `/listing/${listingId}`,
    });
  }
}
