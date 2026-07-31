import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, activeProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { checkRateLimit, RATE_LIMITS } from "./_core/rateLimit";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(2),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este e-mail já está cadastrado.",
          });
        }

        const passwordHash = await bcrypt.hash(input.password, 10);
        const openId = `local:${input.email}`;
        
        const userId = await db.createUser({
          email: input.email,
          passwordHash,
          name: input.name,
          openId,
          loginMethod: "email",
        });

        if (!userId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao criar usuário.",
          });
        }

        const token = await sdk.createSessionToken(openId, { name: input.name });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return { success: true };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha incorretos.",
          });
        }

        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-mail ou senha incorretos.",
          });
        }

        if (!user.openId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Usuário sem openId configurado.",
          });
        }

        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return { success: true };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ COMMUNITIES ============
  communities: router({
    list: publicProcedure.query(() => db.listCommunities()),
    getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
      const community = await db.getCommunityBySlug(input.slug);
      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });
      return community;
    }),
  }),

  // ============ POSTS ============
  posts: router({
    list: publicProcedure.input(z.object({
      communitySlug: z.string().optional(),
      sort: z.enum(['hot', 'new', 'top']).default('hot'),
      limit: z.number().default(20),
      offset: z.number().default(0),
    })).query(async ({ input }) => {
      const posts = await db.listPosts(input.communitySlug, input.sort, input.limit, input.offset);
      // Enrich with author info
      const enriched = await Promise.all(posts.map(async (post) => {
        const author = await db.getUserById(post.authorId);
        const community = await db.getCommunityById(post.communityId);
        return { ...post, authorName: author?.name ?? 'Unknown', authorId: post.authorId, communityName: community?.name ?? 'Unknown', communitySlug: community?.slug ?? '' };
      }));
      return enriched;
    }),
    // Cursor-based version of the feed, for infinite-scroll UIs — doesn't
    // replace `list` above (kept as-is so nothing existing breaks), just an
    // additional endpoint. Pass the previous response's `nextCursor` back in
    // to get the next page; `nextCursor: null` means you've reached the end.
    // Only 'new' sort supports a real cursor (see listPosts in db.ts for why);
    // other sorts silently fall back to offset paging under the hood.
    listCursor: publicProcedure.input(z.object({
      communitySlug: z.string().optional(),
      sort: z.enum(['hot', 'new', 'top']).default('new'),
      limit: z.number().default(20),
      cursor: z.number().optional(),
    })).query(async ({ input }) => {
      const posts = await db.listPosts(input.communitySlug, input.sort, input.limit, 0, input.cursor);
      const enriched = await Promise.all(posts.map(async (post) => {
        const author = await db.getUserById(post.authorId);
        const community = await db.getCommunityById(post.communityId);
        return { ...post, authorName: author?.name ?? 'Unknown', authorId: post.authorId, communityName: community?.name ?? 'Unknown', communitySlug: community?.slug ?? '' };
      }));
      const nextCursor = enriched.length === input.limit ? enriched[enriched.length - 1].id : null;
      return { items: enriched, nextCursor };
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const post = await db.getPostById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      const author = await db.getUserById(post.authorId);
      const community = await db.getCommunityById(post.communityId);
      return { ...post, authorName: author?.name ?? 'Unknown', communityName: community?.name ?? 'Unknown', communitySlug: community?.slug ?? '' };
    }),
    create: activeProcedure.input(z.object({
      communitySlug: z.string(),
      title: z.string().min(1).max(512),
      content: z.string().optional(),
      linkUrl: z.string().url().optional(),
      type: z.enum(['text', 'link']).default('text'),
    })).mutation(async ({ ctx, input }) => {
      checkRateLimit(`post:${ctx.user.id}`, RATE_LIMITS.createPost.max, RATE_LIMITS.createPost.windowMs);
      const community = await db.getCommunityBySlug(input.communitySlug);
      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });
      const id = await db.createPost({
        communityId: community.id,
        authorId: ctx.user.id,
        title: input.title,
        content: input.content ?? null,
        linkUrl: input.linkUrl ?? null,
        type: input.type,
      });
      await db.checkAndAwardBadges(ctx.user.id);
      return { id };
    }),
    getByAuthor: publicProcedure.input(z.object({ authorId: z.number() })).query(async ({ input }) => {
      const posts = await db.getPostsByAuthor(input.authorId);
      const enriched = await Promise.all(posts.map(async (post) => {
        const community = await db.getCommunityById(post.communityId);
        return { ...post, communityName: community?.name ?? 'Unknown', communitySlug: community?.slug ?? '' };
      }));
      return enriched;
    }),
    countByAuthor: publicProcedure.input(z.object({ authorId: z.number() })).query(async ({ input }) => {
      const posts = await db.getPostsByAuthor(input.authorId);
      return posts.length;
    }),
  }),

  // ============ COMMENTS ============
  comments: router({
    listByPost: publicProcedure.input(z.object({ postId: z.number() })).query(async ({ input }) => {
      const comments = await db.listCommentsByPost(input.postId);
      const enriched = await Promise.all(comments.map(async (c) => {
        const author = await db.getUserById(c.authorId);
        return { ...c, authorName: author?.name ?? 'Unknown' };
      }));
      return enriched;
    }),
    create: activeProcedure.input(z.object({
      postId: z.number(),
      content: z.string().min(1),
      parentId: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      checkRateLimit(`comment:${ctx.user.id}`, RATE_LIMITS.createComment.max, RATE_LIMITS.createComment.windowMs);
      const post = await db.getPostById(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      let depth = 0;
      if (input.parentId) {
        const allComments = await db.listCommentsByPost(input.postId);
        const parent = allComments.find(c => c.id === input.parentId);
        if (parent) {
          depth = parent.depth + 1;
          if (depth > 5) depth = 5; // max nesting
        }
      }
      const id = await db.createComment({
        postId: input.postId,
        authorId: ctx.user.id,
        content: input.content,
        parentId: input.parentId ?? null,
        depth,
      });
      await db.checkAndAwardBadges(ctx.user.id);

      // Send notification to post author on new comment
      const cmtPost = await db.getPostById(input.postId);
      if (cmtPost && cmtPost.authorId !== ctx.user.id) {
        await db.createNotification({
          userId: cmtPost.authorId,
          type: 'comment_reply',
          title: 'Novo comentário',
          body: `Alguém comentou no seu post "${cmtPost.title}".`,
          link: `/post/${cmtPost.id}`,
        });
      }

      // Send notification to parent comment author
      if (input.parentId) {
        const parentComment = await db.getCommentById(input.parentId);
        if (parentComment && parentComment.authorId !== ctx.user.id) {
          await db.createNotification({
            userId: parentComment.authorId,
            type: 'comment_reply',
            title: 'Resposta no seu comentário',
            body: 'Alguém respondeu ao seu comentário.',
            link: `/post/${input.postId}`,
          });
        }
      }

      return { id };
    }),
  }),

  // ============ VOTES ============
  votes: router({
    cast: protectedProcedure.input(z.object({
      targetType: z.enum(['post', 'comment']),
      targetId: z.number(),
      value: z.enum(['up', 'down']),
    })).mutation(async ({ ctx, input }) => {
      await db.upsertVote({
        userId: ctx.user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        value: input.value,
      });

      // Send notification on upvote
      if (input.value === 'up') {
        if (input.targetType === 'post') {
          const post = await db.getPostById(input.targetId);
          if (post && post.authorId !== ctx.user.id) {
            await db.createNotification({
              userId: post.authorId,
              type: 'post_upvote',
              title: 'Upvote no seu post',
              body: `Seu post "${post.title}" recebeu um upvote.`,
              link: `/post/${post.id}`,
            });
          }
        }
      }

      // Return updated counts
      if (input.targetType === 'post') {
        const post = await db.getPostById(input.targetId);
        return { upvotes: post?.upvotes ?? 0, downvotes: post?.downvotes ?? 0 };
      } else {
        const allComments = await db.listCommentsByPost(0); // fallback
        const comments = await db.getCommentsByAuthor(0); // fallback
        // Re-fetch comment from db directly
        const db_instance = await db.getDb();
        if (!db_instance) return { upvotes: 0, downvotes: 0 };
        const { comments: commentsTable } = await import('../drizzle/schema');
        const { eq: eqFn } = await import('drizzle-orm');
        const result = await db_instance.select().from(commentsTable).where(eqFn(commentsTable.id, input.targetId)).limit(1);
        return { upvotes: result[0]?.upvotes ?? 0, downvotes: result[0]?.downvotes ?? 0 };
      }
    }),
    getUserVote: protectedProcedure.input(z.object({
      targetType: z.enum(['post', 'comment']),
      targetId: z.number(),
    })).query(async ({ ctx, input }) => {
      const vote = await db.getUserVote(ctx.user.id, input.targetType, input.targetId);
      return { value: vote?.value ?? null };
    }),
  }),

  // ============ LISTINGS (MARKETPLACE) ============
  listings: router({
    list: publicProcedure.input(z.object({
      status: z.enum(['active', 'sold', 'removed']).default('active'),
      limit: z.number().default(20),
      offset: z.number().default(0),
    })).query(async ({ input }) => {
      const items = await db.listListings(input.status, input.limit, input.offset);
      const enriched = await Promise.all(items.map(async (item) => {
        const author = await db.getUserById(item.authorId);
        const profile = await db.getOrCreateProfile(item.authorId);
        return { ...item, authorName: author?.name ?? 'Unknown', authorAvatar: profile?.avatarUrl };
      }));
      return enriched;
    }),
    // Cursor-based version for infinite-scroll (see posts.listCursor above for the pattern).
    listCursor: publicProcedure.input(z.object({
      status: z.enum(['active', 'sold', 'removed']).default('active'),
      limit: z.number().default(20),
      cursor: z.number().optional(),
    })).query(async ({ input }) => {
      const items = await db.listListings(input.status, input.limit, 0, input.cursor);
      const enriched = await Promise.all(items.map(async (item) => {
        const author = await db.getUserById(item.authorId);
        const profile = await db.getOrCreateProfile(item.authorId);
        return { ...item, authorName: author?.name ?? 'Unknown', authorAvatar: profile?.avatarUrl };
      }));
      const nextCursor = enriched.length === input.limit ? enriched[enriched.length - 1].id : null;
      return { items: enriched, nextCursor };
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const listing = await db.getListingById(input.id);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      const author = await db.getUserById(listing.authorId);
      const profile = await db.getOrCreateProfile(listing.authorId);
      return { ...listing, authorName: author?.name ?? 'Unknown', authorAvatar: profile?.avatarUrl, authorEmail: author?.email };
    }),
    create: activeProcedure.input(z.object({
      title: z.string().min(1).max(256),
      bookTitle: z.string().min(1).max(256),
      author: z.string().min(1).max(256),
      price: z.number().min(0),
      condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      checkRateLimit(`listing:${ctx.user.id}`, RATE_LIMITS.createListing.max, RATE_LIMITS.createListing.windowMs);
      const id = await db.createListing({
        authorId: ctx.user.id,
        title: input.title,
        bookTitle: input.bookTitle,
        author: input.author,
        price: input.price,
        condition: input.condition,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
      });
      await db.checkAndAwardBadges(ctx.user.id);
      return { id };
    }),
    getByAuthor: publicProcedure.input(z.object({ authorId: z.number() })).query(async ({ input }) => {
      const items = await db.getListingsByAuthor(input.authorId);
      return items.filter(l => l.status !== 'removed');
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      price: z.number().optional(),
      description: z.string().optional(),
      status: z.enum(['active', 'sold', 'removed']).optional(),
    })).mutation(async ({ ctx, input }) => {
      const listing = await db.getListingById(input.id);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      if (listing.authorId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
      }
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.price !== undefined) updateData.price = input.price;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      await db.updateListing(input.id, updateData as any);
      return { success: true };
    }),
  }),

  // ============ CHAT ============
  chat: router({
    getOrCreateRoom: protectedProcedure.input(z.object({ listingId: z.number() })).mutation(async ({ ctx, input }) => {
      const listing = await db.getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      if (listing.authorId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot chat with yourself" });
      // Check existing room
      let room = await db.getChatRoom(input.listingId, ctx.user.id);
      if (room) return room;
      // Create new room
      const id = await db.createChatRoom({
        listingId: input.listingId,
        buyerId: ctx.user.id,
        sellerId: listing.authorId,
      });
      return { id, listingId: input.listingId, buyerId: ctx.user.id, sellerId: listing.authorId, createdAt: new Date() };
    }),
    getRooms: protectedProcedure.query(async ({ ctx }) => {
      return db.getChatRoomsByUser(ctx.user.id);
    }),
    getRoomById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db_instance = await db.getDb();
      if (!db_instance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { chatRooms: chatRoomsTable } = await import('../drizzle/schema');
      const { eq: eqFn2 } = await import('drizzle-orm');
      const result = await db_instance.select().from(chatRoomsTable).where(eqFn2(chatRoomsTable.id, input.id)).limit(1);
      return result.length > 0 ? result[0] : null;
    }),
    send: protectedProcedure.input(z.object({
      roomId: z.number(),
      content: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.sendMessage({
        roomId: input.roomId,
        senderId: ctx.user.id,
        content: input.content,
      });

      // Notify other participant in the room
      const room = await db.getChatRoomById(input.roomId);
      if (room) {
        const otherUserId = room.buyerId === ctx.user.id ? room.sellerId : room.buyerId;
        if (otherUserId && otherUserId !== ctx.user.id) {
          const listing = await db.getListingById(room.listingId);
          if (listing) {
            await db.createNotification({
              userId: otherUserId,
              type: 'chat_message',
              title: 'Nova mensagem',
              body: `Nova mensagem sobre "${listing.bookTitle}".`,
              link: `/listing/${listing.id}`,
            });
          }
        }
      }

      return { id };
    }),
    listMessages: protectedProcedure.input(z.object({ roomId: z.number() })).query(async ({ input }) => {
      const messages = await db.listMessages(input.roomId);
      const enriched = await Promise.all(messages.map(async (m) => {
        const author = await db.getUserById(m.senderId);
        return { ...m, authorName: author?.name ?? 'Unknown' };
      }));
      return enriched;
    }),
  }),

  // ============ PROFILE ============
  profile: router({
    get: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const profile = await db.getOrCreateProfile(input.userId);
      const posts = await db.getPostsByAuthor(input.userId);
      const comments = await db.getCommentsByAuthor(input.userId);
      const listings = (await db.getListingsByAuthor(input.userId)).filter(l => l.status !== 'removed');
      const badges = await db.getUserBadges(input.userId);
      return {
        user,
        profile: profile ?? { id: 0, userId: input.userId, avatarUrl: null, bio: null, karma: 0 },
        postCount: posts.length,
        commentCount: comments.length,
        listingCount: listings.length,
        badges,
      };
    }),
    update: protectedProcedure.input(z.object({
      bio: z.string().max(500).optional(),
      avatarUrl: z.string().optional(),
      displayName: z.string().max(64).optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateProfile(ctx.user.id, input);
      return { success: true };
    }),
    me: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getOrCreateProfile(ctx.user.id);
      const badges = await db.getUserBadges(ctx.user.id);
      return {
        ...(profile ?? { id: 0, userId: ctx.user.id, avatarUrl: null, bio: null, karma: 0 }),
        badges,
      };
    }),
  }),

  // ============ CHECKOUT (STRIPE) ============
  checkout: router({
    create: activeProcedure.input(z.object({ listingId: z.number() })).mutation(async ({ ctx, input }) => {
      checkRateLimit(`checkout:${ctx.user.id}`, RATE_LIMITS.createCheckout.max, RATE_LIMITS.createCheckout.windowMs);
      const listing = await db.getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      if (listing.authorId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot buy your own listing" });
      if (listing.status !== 'active') throw new TRPCError({ code: "BAD_REQUEST", message: "Listing is not available" });

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? '';
      if (!stripeSecretKey) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Stripe não configurado' });
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-07-29.dahlia' });

      const origin = ctx.req.headers.origin ?? ctx.req.headers.host ?? '';
      const baseUrl = `http${origin.includes('localhost') ? '' : 's'}://${origin}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: listing.bookTitle,
                description: `${listing.title} - ${listing.condition} - por ${listing.author}`,
              },
              unit_amount: Math.round(listing.price * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          listing_id: listing.id.toString(),
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? '',
          customer_name: ctx.user.name ?? '',
        },
        client_reference_id: ctx.user.id.toString(),
        success_url: `${baseUrl}/listing/${input.listingId}?checkout=success`,
        cancel_url: `${baseUrl}/listing/${input.listingId}?checkout=cancelled`,
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
      });

      // Save local record
      const sessionId = await db.createCheckoutSession({
        listingId: input.listingId,
        buyerId: ctx.user.id,
        stripeSessionId: session.id,
        status: 'pending',
      });

      return { checkoutUrl: session.url ?? '', localId: sessionId };
    }),
    // Poll this after redirect back from Stripe (?checkout=success) — the
    // webhook is what actually flips status to 'completed', which can land
    // a moment after the browser redirect.
    status: protectedProcedure.input(z.object({ listingId: z.number() })).query(async ({ ctx, input }) => {
      const session = await db.getCheckoutSessionForListingAndBuyer(input.listingId, ctx.user.id);
      if (!session) return { status: 'none' as const };
      return { status: session.status, deliveryConfirmedAt: session.deliveryConfirmedAt };
    }),
    confirmDelivery: activeProcedure.input(z.object({ listingId: z.number() })).mutation(async ({ ctx, input }) => {
      const session = await db.confirmDelivery(input.listingId, ctx.user.id);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma compra concluída encontrada para esta compra" });
      const listing = await db.getListingById(input.listingId);
      if (listing) {
        await db.createNotification({
          userId: listing.authorId,
          type: "listing_sold",
          title: "Entrega confirmada",
          body: `O comprador confirmou o recebimento de "${listing.bookTitle}".`,
          link: `/listing/${input.listingId}`,
        });
      }
      return { success: true };
    }),
  }),

  // ============ FAVORITES ============
  favorites: router({
    toggle: protectedProcedure.input(z.object({
      targetType: z.enum(['post', 'listing']),
      targetId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.toggleFavorite(ctx.user.id, input.targetType, input.targetId);
      return { status: result };
    }),
    getPostFavorites: protectedProcedure.query(async ({ ctx }) => {
      const ids = await db.getFavoriteIds(ctx.user.id, 'post');
      const items = await Promise.all(ids.map(async (postId) => {
        const post = await db.getPostById(postId);
        if (!post) return null;
        const author = await db.getUserById(post.authorId);
        const community = await db.getCommunityById(post.communityId);
        return { ...post, authorName: author?.name ?? 'Unknown', communityName: community?.name ?? 'Unknown', communitySlug: community?.slug ?? '' };
      }));
      return items.filter(Boolean);
    }),
    getListingFavorites: protectedProcedure.query(async ({ ctx }) => {
      const ids = await db.getFavoriteIds(ctx.user.id, 'listing');
      const items = await Promise.all(ids.map(async (listingId) => {
        const listing = await db.getListingById(listingId);
        if (!listing) return null;
        const author = await db.getUserById(listing.authorId);
        return { ...listing, authorName: author?.name ?? 'Unknown' };
      }));
      return items.filter(Boolean);
    }),
    isFavorite: publicProcedure.input(z.object({
      targetType: z.enum(['post', 'listing']),
      targetId: z.number(),
    })).query(async ({ ctx, input }) => {
      if (!ctx.user) return { isFavorite: false };
      const result = await db.isFavorite(ctx.user.id, input.targetType, input.targetId);
      return { isFavorite: result };
    }),
  }),

  // ============ SEARCH ============
  search: router({
    global: publicProcedure.input(z.object({
      query: z.string().min(1).max(200),
    })).query(async ({ input }) => {
      const results = await db.globalSearch(input.query);
      const enrichedPosts = await Promise.all(results.posts.map(async (post) => {
        const author = await db.getUserById(post.authorId);
        const community = await db.getCommunityById(post.communityId);
        return { ...post, authorName: author?.name ?? 'Unknown', communityName: community?.name ?? 'Unknown', communitySlug: community?.slug ?? '' };
      }));
      const enrichedListings = await Promise.all(results.listings.map(async (listing) => {
        const author = await db.getUserById(listing.authorId);
        return { ...listing, authorName: author?.name ?? 'Unknown' };
      }));
      return {
        posts: enrichedPosts,
        listings: enrichedListings,
        communities: results.communities,
      };
    }),
  }),

  // ============ UPLOAD ============
  upload: router({
    uploadImage: protectedProcedure.input(z.object({
      fileName: z.string().min(1).max(256),
      data: z.string(), // base64 encoded file
      contentType: z.string().min(1),
    })).mutation(async ({ ctx, input }) => {
      const { storagePut } = await import('./storage');
      // Convert base64 to buffer
      const base64Data = input.data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const key = `${ctx.user.id}-uploads/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url, key };
    }),
  }),

  // ============ CREATE COMMUNITY ============
  createCommunity: router({
    create: protectedProcedure.input(z.object({
      name: z.string().min(2).max(128),
      slug: z.string().min(2).max(128).regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
      description: z.string().max(500).optional(),
      icon: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getCommunityBySlug(input.slug);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "Comunidade já existe com esse slug" });
      const id = await db.createCommunity({
        name: input.name,
        slug: input.slug,
        description: input.description,
        icon: input.icon,
        creatorId: ctx.user.id,
      });
      return { id };
    }),
  }),

  // ============ COMMUNITY MEMBERS ============
  communityMembers: router({
    join: protectedProcedure.input(z.object({ communitySlug: z.string() })).mutation(async ({ ctx, input }) => {
      const community = await db.getCommunityBySlug(input.communitySlug);
      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });
      await db.joinCommunity(community.id, ctx.user.id);
      return { success: true };
    }),
    leave: protectedProcedure.input(z.object({ communitySlug: z.string() })).mutation(async ({ ctx, input }) => {
      const community = await db.getCommunityBySlug(input.communitySlug);
      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Community not found" });
      await db.leaveCommunity(community.id, ctx.user.id);
      return { success: true };
    }),
    isMember: protectedProcedure.input(z.object({ communitySlug: z.string() })).query(async ({ ctx, input }) => {
      const community = await db.getCommunityBySlug(input.communitySlug);
      if (!community) return { isMember: false };
      const result = await db.isCommunityMember(community.id, ctx.user.id);
      return { isMember: result };
    }),
  }),

  // ============ REVIEWS ============
  reviews: router({
    create: protectedProcedure.input(z.object({
      listingId: z.number(),
      sellerId: z.number(),
      rating: z.number().min(1).max(5),
      comment: z.string().max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      const already = await db.hasReviewedByBuyer(input.listingId, ctx.user.id);
      if (already) throw new TRPCError({ code: "BAD_REQUEST", message: "Você já avaliou este vendedor" });
      const id = await db.createReview({
        listingId: input.listingId,
        reviewerId: ctx.user.id,
        sellerId: input.sellerId,
        rating: input.rating,
        comment: input.comment ?? null,
      });
      return { id };
    }),
    getBySeller: publicProcedure.input(z.object({ sellerId: z.number() })).query(async ({ input }) => {
      const reviews = await db.getReviewsBySeller(input.sellerId);
      const enriched = await Promise.all(reviews.map(async (r) => {
        const reviewer = await db.getUserById(r.reviewerId);
        return { ...r, reviewerName: reviewer?.name ?? 'Unknown' };
      }));
      const rating = await db.getAverageRating(input.sellerId);
      return { reviews: enriched, ...rating };
    }),
    hasReviewed: publicProcedure.input(z.object({ listingId: z.number(), reviewerId: z.number() })).query(async ({ input }) => {
      const result = await db.hasReviewedByBuyer(input.listingId, input.reviewerId);
      return { hasReviewed: result };
    }),
  }),

  // ============ MODERATION ============
  moderation: router({
    // Any logged-in, non-banned user can report content.
    reportContent: activeProcedure.input(z.object({
      targetType: z.enum(['post', 'comment', 'listing', 'user']),
      targetId: z.number(),
      reason: z.enum(['spam', 'harassment', 'hate_speech', 'misinformation', 'nsfw', 'copyright', 'other']),
      description: z.string().max(1000).optional(),
    })).mutation(async ({ ctx, input }) => {
      checkRateLimit(`report:${ctx.user.id}`, RATE_LIMITS.createReport.max, RATE_LIMITS.createReport.windowMs);
      const id = await db.createReport({
        targetType: input.targetType,
        targetId: input.targetId,
        reporterId: ctx.user.id,
        reason: input.reason,
        description: input.description ?? null,
      });
      return { id };
    }),
    // Admin-only from here down.
    listReports: adminProcedure.input(z.object({
      status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    })).query(async ({ input }) => {
      const items = await db.listReports(input.status, input.limit, input.offset);
      const enriched = await Promise.all(items.map(async (r) => {
        const reporter = await db.getUserById(r.reporterId);
        return { ...r, reporterName: reporter?.name ?? 'Unknown' };
      }));
      return enriched;
    }),
    stats: adminProcedure.query(async () => {
      return db.getModerationStats();
    }),
    getUserModerationHistory: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      return db.getModerationHistoryForUser(input.userId);
    }),
    checkIfBanned: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      const ban = await db.getActiveBan(input.userId);
      return { banned: !!ban, reason: ban?.reason ?? null, unbanAt: ban?.unbanAt ?? null };
    }),
    // Review a report: dismiss it, delete the target content, warn the
    // author, or ban them. Always logs to moderation_actions for audit trail.
    reviewReport: adminProcedure.input(z.object({
      reportId: z.number(),
      action: z.enum(['dismiss', 'delete_content', 'warn', 'ban_user']),
      reason: z.string().max(1000).optional(),
      banDurationDays: z.number().min(1).optional(), // omit for permanent ban
    })).mutation(async ({ ctx, input }) => {
      const report = await db.getReportById(input.reportId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });

      if (input.action === 'delete_content') {
        if (report.targetType === 'post') await db.deletePost(report.targetId);
        else if (report.targetType === 'comment') await db.deleteComment(report.targetId);
        else if (report.targetType === 'listing') await db.deleteListing(report.targetId);
      } else if (input.action === 'ban_user') {
        // For a post/comment/listing report, ban the content's author, not the reporter.
        let userIdToBan = report.targetId;
        if (report.targetType === 'post') {
          const post = await db.getPostById(report.targetId);
          if (post) userIdToBan = post.authorId;
        } else if (report.targetType === 'comment') {
          const comment = await db.getCommentById(report.targetId);
          if (comment) userIdToBan = comment.authorId;
        } else if (report.targetType === 'listing') {
          const listing = await db.getListingById(report.targetId);
          if (listing) userIdToBan = listing.authorId;
        }
        const unbanAt = input.banDurationDays
          ? new Date(Date.now() + input.banDurationDays * 24 * 60 * 60 * 1000)
          : null;
        await db.banUser(userIdToBan, ctx.user.id, input.reason ?? 'Violação das diretrizes da comunidade', unbanAt);
        await db.logModerationAction({
          reportId: input.reportId,
          actionType: 'ban_user',
          targetType: 'user',
          targetId: userIdToBan,
          moderatorId: ctx.user.id,
          reason: input.reason ?? null,
        });
      }

      if (input.action !== 'ban_user') {
        await db.logModerationAction({
          reportId: input.reportId,
          actionType: input.action,
          targetType: report.targetType,
          targetId: report.targetId,
          moderatorId: ctx.user.id,
          reason: input.reason ?? null,
        });
      }

      await db.updateReportStatus(input.reportId, input.action === 'dismiss' ? 'dismissed' : 'resolved');
      return { success: true };
    }),
    unbanUser: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input }) => {
      await db.unbanUser(input.userId);
      return { success: true };
    }),
  }),

  // ============ BADGES ============
  badges: router({
    getUserBadges: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      return db.getUserBadges(input.userId);
    }),
    checkAndAward: protectedProcedure.mutation(async ({ ctx }) => {
      await db.checkAndAwardBadges(ctx.user.id);
      return db.getUserBadges(ctx.user.id);
    }),
  }),

  // ============ NOTIFICATIONS ============
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserNotifications(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const count = await db.getUnreadCount(ctx.user.id);
      return { count };
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.markNotificationRead(input.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ============ FEATURED LISTINGS ============
  featured: router({
    active: publicProcedure.query(async () => {
      return db.getActiveFeaturedListings();
    }),
    feature: protectedProcedure.input(z.object({
      listingId: z.number(),
      durationDays: z.number().min(1).max(30).default(7),
    })).mutation(async ({ ctx, input }) => {
      const listing = await db.getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      if (listing.authorId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your listing" });

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? '';
      if (!stripeSecretKey) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Stripe não configurado' });
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-07-29.dahlia' });

      const origin = ctx.req.headers.origin ?? ctx.req.headers.host ?? '';
      const baseUrl = `http${origin.includes('localhost') ? '' : 's'}://${origin}`;
      const priceCents = input.durationDays * 500; // R$5/dia

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'brl',
            product_data: { name: `Destaque - ${listing.bookTitle} (${input.durationDays} dias)` },
            unit_amount: priceCents,
          },
          quantity: 1,
        }],
        metadata: {
          listing_id: listing.id.toString(),
          user_id: ctx.user.id.toString(),
          duration_days: input.durationDays.toString(),
        },
        client_reference_id: ctx.user.id.toString(),
        success_url: `${baseUrl}/listing/${input.listingId}?featured=success`,
        cancel_url: `${baseUrl}/listing/${input.listingId}`,        customer_email: ctx.user.email ?? undefined,
      });

      // Create featured listing record (activated on webhook)
      const featureId = await db.createFeaturedListing({
        listingId: input.listingId,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + input.durationDays * 86400000),
        stripeSessionId: session.id,
        isActive: false, // activated on webhook
      });

      return { checkoutUrl: session.url ?? '', featureId };
    }),
  }),

  // ============ FILTERED LISTINGS ============
  filteredListings: router({
    list: publicProcedure.input(z.object({
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
      query: z.string().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    })).query(async ({ input }) => {
      const items = await db.listListingsWithFilters(input);
      const enriched = await Promise.all(items.map(async (item) => {
        const author = await db.getUserById(item.authorId);
        const profile = await db.getOrCreateProfile(item.authorId);
        const featured = await db.isListingFeatured(item.id);
        const rating = await db.getAverageRating(item.authorId);
        return {
          ...item,
          authorName: author?.name ?? 'Unknown',
          authorAvatar: profile?.avatarUrl,
          featured,
          sellerRating: typeof rating === 'number' ? rating : rating.avg,
          sellerReviewCount: typeof rating === 'number' ? 0 : rating.count,
        };
      }));
      return enriched;
    }),
  }),
  // ============ BOOKS ============
  books: router({
    list: publicProcedure.input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    })).query(async ({ input }) => {
      return db.listBooks(input.limit, input.offset);
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const book = await db.getBookById(input.id);
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      return book;
    }),
    search: publicProcedure.input(z.object({ query: z.string() })).query(async ({ input }) => {
      return db.searchBooks(input.query);
    }),
    create: protectedProcedure.input(z.object({
      isbn: z.string().optional(),
      title: z.string(),
      author: z.string(),
      description: z.string().optional(),
      genre: z.string().optional(),
      coverUrl: z.string().optional(),
      publishedYear: z.number().optional(),
      publisher: z.string().optional(),
      pageCount: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: "FORBIDDEN" });
      const id = await db.createBook(input);
      return { id };
    }),
  }),
  // ============ READING LIST ============
  readingList: router({
    add: protectedProcedure.input(z.object({
      bookId: z.number(),
      status: z.enum(['read', 'reading', 'want_to_read']),
      rating: z.number().min(1).max(5).optional(),
      review: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.addToReadingList({
        userId: ctx.user.id,
        bookId: input.bookId,
        status: input.status as any,
        rating: input.rating,
        review: input.review,
      });
      return { id };
    }),
    get: protectedProcedure.input(z.object({
      status: z.enum(['read', 'reading', 'want_to_read']).optional(),
    })).query(async ({ ctx, input }) => {
      return db.getUserReadingListWithBooks(ctx.user.id, input.status as any);
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['read', 'reading', 'want_to_read']).optional(),
      rating: z.number().min(1).max(5).optional(),
      review: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const item = await db.getUserReadingList(ctx.user.id);
      const found = item.find(i => i.id === input.id);
      if (!found) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateReadingListItem(input.id, input);
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const item = await db.getUserReadingList(ctx.user.id);
      const found = item.find(i => i.id === input.id);
      if (!found) throw new TRPCError({ code: "NOT_FOUND" });
      await db.removeFromReadingList(input.id);
      return { success: true };
    }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserReadingStats(ctx.user.id);
    }),
  }),
  // ============ READING GOALS ============
  readingGoals: router({
    create: protectedProcedure.input(z.object({
      year: z.number(),
      targetBooks: z.number().min(1),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createReadingGoal({
        userId: ctx.user.id,
        year: input.year,
        targetBooks: input.targetBooks,
      });
      return { id };
    }),
    get: protectedProcedure.input(z.object({ year: z.number() })).query(async ({ ctx, input }) => {
      return db.getUserReadingGoal(ctx.user.id, input.year);
    }),
  }),
  // ============ BOOK REVIEWS ============
  bookReviews: router({
    create: protectedProcedure.input(z.object({
      bookId: z.number(),
      rating: z.number().min(1).max(5),
      title: z.string().optional(),
      content: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createBookReview({
        bookId: input.bookId,
        userId: ctx.user.id,
        rating: input.rating,
        title: input.title,
        content: input.content,
      });
      return { id };
    }),
    list: publicProcedure.input(z.object({
      bookId: z.number(),
      limit: z.number().default(10),
      offset: z.number().default(0),
    })).query(async ({ input }) => {
      return db.getBookReviews(input.bookId, input.limit, input.offset);
    }),
  }),
  // ============ RECOMMENDATIONS ============
  recommendations: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserRecommendations(ctx.user.id);
    }),
  }),
  // ============ TRENDING ============
  trending: router({
    mostMentionedBooks: publicProcedure.input(z.object({
      limit: z.number().default(10),
    })).query(async ({ input }) => {
      return db.getMostMentionedBooks(input.limit);
    }),
  }),
  // ============ WEEKLY PICK ============
  weeklyPick: router({
    get: publicProcedure.query(async () => {
      const topMentioned = await db.getMostMentionedBooks(1);
      if (topMentioned.length > 0) return topMentioned[0];
      const books = await db.listBooks(1, 0);
      return books.length > 0 ? { book: books[0], mentionCount: 0 } : null;
    }),
  }),
  // ============ BOOK EXTERNAL SEARCH ============
  bookSearch: router({
    searchExternal: publicProcedure.input(z.object({
      query: z.string().min(1),
    })).query(async ({ input }) => {
      const q = encodeURIComponent(input.query);
      const results: Array<{
        externalId: string;
        source: 'google' | 'openlibrary';
        title: string;
        author: string;
        description?: string;
        coverUrl?: string;
        isbn?: string;
        publishedYear?: number;
        publisher?: string;
        pageCount?: number;
        genre?: string;
      }> = [];
      try {
        const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=6`);
        if (googleRes.ok) {
          const googleData = await googleRes.json() as any;
          for (const item of (googleData.items ?? [])) {
            const vol = item.volumeInfo ?? {};
            const isbn = (vol.industryIdentifiers ?? []).find((i: any) => i.type === 'ISBN_13')?.identifier
              ?? (vol.industryIdentifiers ?? []).find((i: any) => i.type === 'ISBN_10')?.identifier;
            results.push({
              externalId: item.id,
              source: 'google',
              title: vol.title ?? 'Sem título',
              author: (vol.authors ?? ['Autor desconhecido']).join(', '),
              description: vol.description,
              coverUrl: vol.imageLinks?.thumbnail?.replace('http://', 'https://'),
              isbn,
              publishedYear: vol.publishedDate ? parseInt(vol.publishedDate.slice(0, 4)) : undefined,
              publisher: vol.publisher,
              pageCount: vol.pageCount,
              genre: (vol.categories ?? [])[0],
            });
          }
        }
      } catch (e) { /* ignore */ }
      if (results.length < 3) {
        try {
          const olRes = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=6`);
          if (olRes.ok) {
            const olData = await olRes.json() as any;
            for (const doc of (olData.docs ?? []).slice(0, 6)) {
              const isbn = doc.isbn?.[0];
              const coverId = doc.cover_i;
              results.push({
                externalId: doc.key ?? doc.isbn?.[0] ?? Math.random().toString(),
                source: 'openlibrary',
                title: doc.title ?? 'Sem título',
                author: (doc.author_name ?? ['Autor desconhecido'])[0],
                description: undefined,
                coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined,
                isbn,
                publishedYear: doc.first_publish_year,
                publisher: doc.publisher?.[0],
                pageCount: doc.number_of_pages_median,
                genre: doc.subject?.[0],
              });
            }
          }
        } catch (e) { /* ignore */ }
      }
      return results.slice(0, 8);
    }),
    importBook: protectedProcedure.input(z.object({
      title: z.string(),
      author: z.string(),
      description: z.string().optional(),
      coverUrl: z.string().optional(),
      isbn: z.string().optional(),
      publishedYear: z.number().optional(),
      publisher: z.string().optional(),
      pageCount: z.number().optional(),
      genre: z.string().optional(),
    })).mutation(async ({ input }) => {
      if (input.isbn) {
        const existing = await db.getBookByISBN(input.isbn);
        if (existing) return { id: existing.id, existed: true };
      }
      const id = await db.createBookPublic(input);
      return { id, existed: false };
    }),
  }),
  // ============ AI READING ASSISTANT ============
  ai: router({
    chat: protectedProcedure.input(z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })),
      userBookHistory: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      const { invokeLLM } = await import('./_core/llm');
      let readingContext = '';
      if (input.userBookHistory) {
        const readList = await db.getUserReadingList(ctx.user.id);
        if (readList.length > 0) {
          const bookIds = readList.map(r => r.bookId);
          const bookDetails = await Promise.all(bookIds.slice(0, 10).map(id => db.getBookById(id)));
          const readBooks = bookDetails.filter(Boolean).map(b => `"${b!.title}" de ${b!.author}`).join(', ');
          readingContext = `\nO usuário já leu ou está lendo: ${readBooks}.`;
        }
      }
      const systemPrompt = `Você é o Inkwell AI, um assistente especializado em literatura. Você ajuda leitores a descobrir novos livros, analisa resenhas, discute tramas e personagens, e oferece recomendações personalizadas.${readingContext}\n\nResponda sempre em português brasileiro. Seja entusiasta sobre literatura, mas conciso.`;
      const llmMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...input.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
      const response = await invokeLLM({ messages: llmMessages });
      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0].message.content
        : 'Desculpe, não consegui processar sua mensagem.';
      return { content };
    }),
    detectBookMentions: protectedProcedure.input(z.object({
      text: z.string(),
    })).mutation(async ({ input }) => {
      if (!input.text || input.text.length < 5) return { books: [] };
      const { invokeLLM } = await import('./_core/llm');
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Você é um detector de menções de livros. Analise o texto e retorne APENAS um JSON válido: {"books": [{"title": "Título", "author": "Autor ou null"}]}. Se não houver livros, retorne {"books": []}.' },
          { role: 'user', content: input.text },
        ],
      });
      try {
        const raw = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content : '{"books":[]}';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch?.[0] ?? '{"books":[]}');
        return { books: parsed.books ?? [] };
      } catch { return { books: [] }; }
    }),
    recordMentions: protectedProcedure.input(z.object({
      bookTitles: z.array(z.string()),
      postId: z.number().optional(),
      commentId: z.number().optional(),
    })).mutation(async ({ input }) => {
      const recorded: number[] = [];
      for (const title of input.bookTitles) {
        const matches = await db.searchBooks(title, 1);
        if (matches.length > 0) {
          const id = await db.recordBookMention({ bookId: matches[0].id, postId: input.postId, commentId: input.commentId });
          if (id) recorded.push(id);
        }
      }
      return { recorded };
    }),
    suggestReading: protectedProcedure.mutation(async ({ ctx }) => {
      const { invokeLLM } = await import('./_core/llm');
      const readList = await db.getUserReadingList(ctx.user.id);
      const bookIds = readList.map(r => r.bookId);
      const bookDetails = await Promise.all(bookIds.slice(0, 15).map(id => db.getBookById(id)));
      const readBooks = bookDetails.filter(Boolean).map(b => `"${b!.title}" de ${b!.author} (${b!.genre ?? 'gênero não informado'})`).join(', ');
      const prompt = readBooks
        ? `Com base nos livros que o usuário leu: ${readBooks}. Sugira 3 livros que ele provavelmente vai adorar. Para cada livro, inclua título, autor e uma breve razão (1 frase).`
        : 'Sugira 3 livros clássicos da literatura brasileira e mundial que todo leitor deveria conhecer. Para cada livro, inclua título, autor e uma breve razão (1 frase).';
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'Você é um especialista em literatura. Responda em português brasileiro. Retorne APENAS um JSON válido: {"suggestions": [{"title": "...", "author": "...", "reason": "..."}]}' },
          { role: 'user', content: prompt },
        ],
      });
      let suggestions: Array<{ title: string; author: string; reason: string }> = [];
      try {
        const raw = typeof response.choices[0]?.message?.content === 'string'
          ? response.choices[0].message.content : '{"suggestions":[]}';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch?.[0] ?? '{"suggestions":[]}');
        suggestions = parsed.suggestions ?? [];
      } catch { suggestions = []; }

      // Buscar livros sugeridos no banco local para enriquecer com ID, capa e avaliação
      const enrichedSuggestions = await Promise.all(
        suggestions.map(async (s) => {
          const query = encodeURIComponent(`${s.title} ${s.author}`);
          let book: { id: number; title: string; author: string; coverUrl: string | null; averageRating: number; genre: string | null } | null = null;
          try {
            const matches = await db.searchBooks(`${s.title} ${s.author}`, 1);
            if (matches.length > 0) {
              const b = matches[0];
              book = { id: b.id, title: b.title, author: b.author, coverUrl: b.coverUrl, averageRating: b.averageRating, genre: b.genre };
            }
          } catch { /* ignore */ }
          return {
            title: s.title,
            author: s.author,
            reason: s.reason,
            book,
          };
        })
      );

      return { suggestions: enrichedSuggestions };
    }),
  }),
});

export type AppRouter = typeof appRouter;
