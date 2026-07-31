import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Same as protectedProcedure, but additionally rejects banned users. Use this
// (instead of protectedProcedure) for mutations that create or send content —
// posts, comments, listings, chat messages, checkout — so a ban actually
// stops someone from acting, not just from logging in.
export const activeProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const { getActiveBan } = await import("../db");
    const ban = await getActiveBan(ctx.user.id);
    if (ban) {
      const until = ban.unbanAt ? ` até ${ban.unbanAt.toLocaleDateString('pt-BR')}` : " permanentemente";
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Sua conta foi banida${until}. Motivo: ${ban.reason ?? "não especificado"}.`,
      });
    }
    return next({ ctx });
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
