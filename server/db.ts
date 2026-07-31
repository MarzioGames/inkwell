import { and, desc, eq, sql, or, lte, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  userProfiles, InsertUserProfile,
  communities, InsertCommunity,
  communityMembers, InsertCommunityMember,
  posts, InsertPost,
  comments, InsertComment,
  votes, InsertVote,
  listings, InsertListing,
  chatRooms, InsertChatRoom,
  chatMessages, InsertChatMessage,
  checkoutSessions, InsertCheckoutSession,
  reports, InsertReport,
  moderationActions, InsertModerationAction,
  bannedUsers, InsertBannedUser,
  favorites, InsertFavorite,
  reviews, InsertReview,
  userBadges, InsertUserBadge,
  notifications, InsertNotification,
  featuredListings, InsertFeaturedListing,
  books, InsertBook,
  userReadingList, InsertUserReadingListItem,
  readingGoals, InsertReadingGoal,
  bookMentions, InsertBookMention,
  bookReviews, InsertBookReview,
  bookRecommendations, InsertBookRecommendation,
  userFavoriteGenres, InsertUserFavoriteGenre,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USERS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach((field) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    });
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ USER PROFILES ============

export async function getOrCreateProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  let profile = (await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1))[0];
  if (!profile) {
    const user = await getUserById(userId);
    const [created] = await db.insert(userProfiles).values({
      userId,
      bio: null,
      avatarUrl: null,
      karma: 0,
    });
    profile = {
      id: created.insertId,
      userId,
      avatarUrl: null,
      bio: null,
      karma: 0,
    };
  }
  return profile;
}

export async function updateProfile(userId: number, data: { bio?: string; avatarUrl?: string; displayName?: string }) {
  const db = await getDb();
  if (!db) return;
  const profile = await getOrCreateProfile(userId);
  if (!profile) return;
  const updateSet: Record<string, unknown> = {};
  if (data.bio !== undefined) updateSet.bio = data.bio;
  if (data.avatarUrl !== undefined) updateSet.avatarUrl = data.avatarUrl;
  if (Object.keys(updateSet).length > 0) {
    await db.update(userProfiles).set(updateSet).where(eq(userProfiles.userId, userId));
  }
}

export async function getUserKarma(userId: number) {
  const profile = await getOrCreateProfile(userId);
  return profile?.karma ?? 0;
}

export async function updateKarma(userId: number, delta: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(userProfiles).set({ karma: sql`karma + ${delta}` }).where(eq(userProfiles.userId, userId));
}

// ============ COMMUNITIES ============

export async function listCommunities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communities).orderBy(desc(communities.memberCount));
}

export async function getCommunityBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(communities).where(eq(communities.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCommunityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(communities).where(eq(communities.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ POSTS ============

export async function createPost(data: InsertPost) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(posts).values(data);
  return result.insertId;
}

export async function listPosts(communitySlug?: string, sort: 'hot' | 'new' | 'top' = 'hot', limit = 20, offset = 0, cursor?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (communitySlug) {
    const community = await getCommunityBySlug(communitySlug);
    if (community) conditions.push(eq(posts.communityId, community.id));
  }
  // Cursor pagination only applies to 'new' (id-ordered). 'hot'/'top' are
  // ordered by a score that can change between pages, so an id-based cursor
  // would skip/duplicate rows there — those keep offset-based paging.
  if (cursor && sort === 'new') {
    conditions.push(lt(posts.id, cursor));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  if (sort === 'hot') {
    return db.select().from(posts)
      .where(whereClause)
      .orderBy(sql`(upvotes - downvotes) DESC`, desc(posts.createdAt))
      .limit(limit).offset(offset);
  } else if (sort === 'new') {
    return db.select().from(posts)
      .where(whereClause)
      .orderBy(desc(posts.id))
      .limit(limit)
      .offset(cursor ? 0 : offset);
  } else {
    return db.select().from(posts)
      .where(whereClause)
      .orderBy(sql`(upvotes - downvotes) DESC`)
      .limit(limit).offset(offset);
  }
}

export async function getPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPostsByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).where(eq(posts.authorId, authorId)).orderBy(desc(posts.createdAt));
}

// Soft delete: redacts content instead of hard-deleting, so comment threads
// and reply counts don't break for a moderated post.
export async function deletePost(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(posts)
    .set({ title: "[removido pela moderação]", content: "[Este conteúdo foi removido por violar as diretrizes da comunidade]", linkUrl: null })
    .where(eq(posts.id, id));
}

export async function updatePostVotes(id: number, upvotes: number, downvotes: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(posts).set({ upvotes, downvotes }).where(eq(posts.id, id));
}

// ============ COMMENTS ============

export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(comments).values(data);
  // Update post comment count
  const post = await getPostById(data.postId);
  if (post) {
    await db.update(posts).set({ commentCount: sql`commentCount + 1` }).where(eq(posts.id, data.postId));
  }
  return result.insertId;
}

export async function listCommentsByPost(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(sql`depth ASC`, comments.createdAt);
}

export async function getCommentsByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comments).where(eq(comments.authorId, authorId)).orderBy(desc(comments.createdAt));
}

export async function getCommentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return result[0] ?? null;
}

// Soft delete: redacts content instead of hard-deleting, so replies nested
// under this comment (via parentId) don't get orphaned.
export async function deleteComment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(comments)
    .set({ content: "[Este comentário foi removido por violar as diretrizes da comunidade]" })
    .where(eq(comments.id, id));
}

export async function updateCommentVotes(id: number, upvotes: number, downvotes: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(comments).set({ upvotes, downvotes }).where(eq(comments.id, id));
}

// ============ VOTES ============

export async function getUserVote(userId: number, targetType: 'post' | 'comment', targetId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.targetType, targetType as any), eq(votes.targetId, targetId)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertVote(data: InsertVote) {
  const db = await getDb();
  if (!db) return;
  // Check existing vote
  const existing = await getUserVote(data.userId, data.targetType as 'post' | 'comment', data.targetId);
  if (existing) {
    if (existing.value === data.value) {
      // Remove vote (toggle off)
      await db.delete(votes).where(eq(votes.id, existing.id));
      if (data.targetType === 'post') {
        const post = await getPostById(data.targetId);
        if (post) {
          const oldVal = existing.value === 'up' ? -1 : 1;
          await db.update(posts).set({
            upvotes: sql`upvotes + ${oldVal === -1 ? -1 : 0}`,
            downvotes: sql`downvotes + ${oldVal === 1 ? -1 : 0}`,
          }).where(eq(posts.id, data.targetId));
          await updateKarma(data.userId, oldVal);
        }
      } else {
        const comment = (await db.select().from(comments).where(eq(comments.id, data.targetId)).limit(1))[0];
        if (comment) {
          const oldVal = existing.value === 'up' ? -1 : 1;
          await db.update(comments).set({
            upvotes: sql`upvotes + ${oldVal === -1 ? -1 : 0}`,
            downvotes: sql`downvotes + ${oldVal === 1 ? -1 : 0}`,
          }).where(eq(comments.id, data.targetId));
          await updateKarma(data.userId, oldVal);
        }
      }
      return;
    }
    // Change vote
    await db.update(votes).set({ value: data.value }).where(eq(votes.id, existing.id));
    if (data.targetType === 'post') {
      const post = await getPostById(data.targetId);
      if (post) {
        const oldUp = existing.value === 'up' ? -1 : 0;
        const oldDown = existing.value === 'down' ? -1 : 0;
        const newUp = data.value === 'up' ? 1 : 0;
        const newDown = data.value === 'down' ? 1 : 0;
        await db.update(posts).set({
          upvotes: sql`upvotes + ${oldUp + newUp}`,
          downvotes: sql`downvotes + ${oldDown + newDown}`,
        }).where(eq(posts.id, data.targetId));
        await updateKarma(data.userId, (newUp - oldUp) - (newDown - oldDown));
      }
    } else {
      const comment = (await db.select().from(comments).where(eq(comments.id, data.targetId)).limit(1))[0];
      if (comment) {
        const oldUp = existing.value === 'up' ? -1 : 0;
        const oldDown = existing.value === 'down' ? -1 : 0;
        const newUp = data.value === 'up' ? 1 : 0;
        const newDown = data.value === 'down' ? 1 : 0;
        await db.update(comments).set({
          upvotes: sql`upvotes + ${oldUp + newUp}`,
          downvotes: sql`downvotes + ${oldDown + newDown}`,
        }).where(eq(comments.id, data.targetId));
        await updateKarma(data.userId, (newUp - oldUp) - (newDown - oldDown));
      }
    }
  } else {
    // New vote
    await db.insert(votes).values(data);
    if (data.targetType === 'post') {
      if (data.value === 'up') {
        await db.update(posts).set({ upvotes: sql`upvotes + 1` }).where(eq(posts.id, data.targetId));
        await updateKarma(data.userId, 1);
      } else {
        await db.update(posts).set({ downvotes: sql`downvotes + 1` }).where(eq(posts.id, data.targetId));
        await updateKarma(data.userId, -1);
      }
    } else {
      if (data.value === 'up') {
        await db.update(comments).set({ upvotes: sql`upvotes + 1` }).where(eq(comments.id, data.targetId));
        await updateKarma(data.userId, 1);
      } else {
        await db.update(comments).set({ downvotes: sql`downvotes + 1` }).where(eq(comments.id, data.targetId));
        await updateKarma(data.userId, -1);
      }
    }
  }
}

// ============ LISTINGS ============

export async function createListing(data: InsertListing) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(listings).values(data);
  return result.insertId;
}

export async function listListings(status: 'active' | 'sold' | 'removed' = 'active', limit = 20, offset = 0, cursor?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(listings.status, status)];
  if (cursor) conditions.push(lt(listings.id, cursor));
  return db.select().from(listings)
    .where(and(...conditions))
    .orderBy(desc(listings.id))
    .limit(limit)
    .offset(cursor ? 0 : offset);
}

export async function getListingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getListingsByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listings).where(eq(listings.authorId, authorId)).orderBy(desc(listings.createdAt));
}

export async function updateListing(id: number, data: Partial<InsertListing>) {
  const db = await getDb();
  if (!db) return;
  await db.update(listings).set(data).where(eq(listings.id, id));
}

export async function deleteListing(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(listings).set({ status: 'removed' }).where(eq(listings.id, id));
}

// ============ CHAT ============

export async function createChatRoom(data: InsertChatRoom) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(chatRooms).values(data);
  return result.insertId;
}

export async function getChatRoomById(roomId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
  return result[0] ?? null;
}

export async function getChatRoom(listingId: number, buyerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chatRooms)
    .where(and(eq(chatRooms.listingId, listingId), eq(chatRooms.buyerId, buyerId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getChatRoomsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const asBuyer = await db.select().from(chatRooms).where(eq(chatRooms.buyerId, userId)).orderBy(desc(chatRooms.createdAt));
  const asSeller = await db.select().from(chatRooms).where(eq(chatRooms.sellerId, userId)).orderBy(desc(chatRooms.createdAt));
  return [...asBuyer, ...asSeller].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function sendMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(chatMessages).values(data);
  return result.insertId;
}

export async function listMessages(roomId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.roomId, roomId)).orderBy(chatMessages.createdAt);
}

// ============ CHECKOUT SESSIONS ============

export async function createCheckoutSession(data: InsertCheckoutSession) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(checkoutSessions).values(data);
  return result.insertId;
}

export async function updateCheckoutSession(id: number, data: Partial<InsertCheckoutSession>) {
  const db = await getDb();
  if (!db) return;
  await db.update(checkoutSessions).set(data).where(eq(checkoutSessions.id, id));
}

export async function getCheckoutSessionByStripeId(stripeSessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(checkoutSessions)
    .where(eq(checkoutSessions.stripeSessionId, stripeSessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCheckoutSessionStatus(stripeSessionId: string, status: 'pending' | 'completed' | 'failed' | 'expired') {
  const db = await getDb();
  if (!db) return;
  await db.update(checkoutSessions)
    .set({ status, completedAt: status === 'completed' ? new Date() : undefined })
    .where(eq(checkoutSessions.stripeSessionId, stripeSessionId));
}

export async function confirmDelivery(listingId: number, buyerId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(checkoutSessions)
    .where(and(eq(checkoutSessions.listingId, listingId), eq(checkoutSessions.buyerId, buyerId), eq(checkoutSessions.status, 'completed')))
    .orderBy(desc(checkoutSessions.completedAt))
    .limit(1);
  if (result.length === 0) return null;
  await db.update(checkoutSessions).set({ deliveryConfirmedAt: new Date() }).where(eq(checkoutSessions.id, result[0].id));
  return result[0];
}

export async function getCheckoutSessionForListingAndBuyer(listingId: number, buyerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(checkoutSessions)
    .where(and(eq(checkoutSessions.listingId, listingId), eq(checkoutSessions.buyerId, buyerId)))
    .orderBy(desc(checkoutSessions.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}
// ============ FAVORITES ============

export async function toggleFavorite(userId: number, targetType: 'post' | 'listing', targetId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.targetType, targetType as any), eq(favorites.targetId, targetId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return 'removed';
  }
  const [result] = await db.insert(favorites).values({ userId, targetType, targetId });
  return 'added';
}

export async function getUserFavorites(userId: number, targetType: 'post' | 'listing') {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.targetType, targetType as any)))
    .orderBy(desc(favorites.createdAt));
}

export async function getFavoritesByType(targetType: string, targetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(favorites)
    .where(and(eq(favorites.targetType, targetType as any), eq(favorites.targetId, targetId)));
}

export async function getFavoriteIds(userId: number, targetType: 'post' | 'listing') {
  const favs = await getUserFavorites(userId, targetType);
  return favs.map(f => f.targetId);
}

export async function isFavorite(userId: number, targetType: 'post' | 'listing', targetId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.targetType, targetType as any), eq(favorites.targetId, targetId)))
    .limit(1);
  return result.length > 0;
}

// ============ MODERATION ============

export async function createReport(data: InsertReport) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(reports).values(data);
  return result.insertId;
}

export async function listReports(status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed', limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(reports).orderBy(desc(reports.createdAt)).limit(limit).offset(offset);
  if (status) {
    return db.select().from(reports).where(eq(reports.status, status)).orderBy(desc(reports.createdAt)).limit(limit).offset(offset);
  }
  return query;
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateReportStatus(id: number, status: 'pending' | 'reviewed' | 'resolved' | 'dismissed') {
  const db = await getDb();
  if (!db) return;
  await db.update(reports).set({ status }).where(eq(reports.id, id));
}

export async function logModerationAction(data: InsertModerationAction) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(moderationActions).values(data);
  return result.insertId;
}

export async function getModerationHistoryForUser(targetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(moderationActions)
    .where(and(eq(moderationActions.targetType, 'user'), eq(moderationActions.targetId, targetId)))
    .orderBy(desc(moderationActions.createdAt));
}

export async function banUser(userId: number, bannedById: number, reason: string, unbanAt: Date | null) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(bannedUsers).where(eq(bannedUsers.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(bannedUsers).set({ reason, bannedById, unbanAt }).where(eq(bannedUsers.userId, userId));
  } else {
    await db.insert(bannedUsers).values({ userId, bannedById, reason, unbanAt: unbanAt ?? undefined });
  }
}

export async function unbanUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(bannedUsers).where(eq(bannedUsers.userId, userId));
}

export async function getActiveBan(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(bannedUsers).where(eq(bannedUsers.userId, userId)).limit(1);
  if (result.length === 0) return null;
  const ban = result[0];
  // Ban expired on its own — clean it up and treat as not banned.
  if (ban.unbanAt && ban.unbanAt.getTime() <= Date.now()) {
    await unbanUser(userId);
    return null;
  }
  return ban;
}

export async function getModerationStats() {
  const db = await getDb();
  if (!db) return { pendingReports: 0, totalBans: 0 };
  const pending = await db.select().from(reports).where(eq(reports.status, 'pending'));
  const bans = await db.select().from(bannedUsers);
  return { pendingReports: pending.length, totalBans: bans.length };
}

// ============ SEARCH ============

export async function globalSearch(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return { posts: [], listings: [], communities: [] };
  const q = `%${query}%`;

  // Try FULLTEXT (needs drizzle/manual/0002_fulltext_indexes.sql applied).
  // Falls back to LIKE automatically if the index isn't there yet, so this
  // keeps working before/after that migration is run.
  let postsResult;
  try {
    postsResult = await db.select().from(posts)
      .where(sql`MATCH(title, content) AGAINST(${query} IN NATURAL LANGUAGE MODE)`)
      .orderBy(sql`MATCH(title, content) AGAINST(${query} IN NATURAL LANGUAGE MODE) DESC`)
      .limit(limit);
    if (postsResult.length === 0 && query.length > 0) throw new Error("no fulltext matches, try LIKE fallback");
  } catch {
    postsResult = await db.select().from(posts)
      .where(sql`title LIKE ${q} OR content LIKE ${q}`)
      .orderBy(desc(posts.createdAt))
      .limit(limit);
  }

  let listingsResult;
  try {
    listingsResult = await db.select().from(listings)
      .where(and(
        eq(listings.status, 'active'),
        sql`MATCH(title, bookTitle, author, description) AGAINST(${query} IN NATURAL LANGUAGE MODE)`
      ))
      .limit(limit);
    if (listingsResult.length === 0 && query.length > 0) throw new Error("no fulltext matches, try LIKE fallback");
  } catch {
    listingsResult = await db.select().from(listings)
      .where(and(
        eq(listings.status, 'active'),
        sql`title LIKE ${q} OR bookTitle LIKE ${q} OR author LIKE ${q}`
      ))
      .orderBy(desc(listings.createdAt))
      .limit(limit);
  }

  const communitiesResult = await db.select().from(communities)
    .where(sql`name LIKE ${q} OR description LIKE ${q}`)
    .orderBy(communities.memberCount)
    .limit(limit);

  return { posts: postsResult, listings: listingsResult, communities: communitiesResult };
}

// ============ COMMUNITY MEMBERS ============

export async function joinCommunity(communityId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(communityMembers).values({ communityId, userId, role: 'member' });
    await db.update(communities).set({ memberCount: sql`memberCount + 1` }).where(eq(communities.id, communityId));
  }
}

export async function leaveCommunity(communityId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)));
  await db.update(communities).set({ memberCount: sql`GREATEST(memberCount - 1, 0)` }).where(eq(communities.id, communityId));
}

export async function isCommunityMember(communityId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  return result.length > 0;
}

export async function getUserCommunities(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select().from(communityMembers).where(eq(communityMembers.userId, userId));
  const communityIds = members.map(m => m.communityId);
  if (communityIds.length === 0) return [];
  return db.select().from(communities).where(sql`${communities.id} IN (${sql.join(communityIds.map(id => sql`${id}`), sql`, `)})`);
}

// ============ CREATE COMMUNITY ============

export async function createCommunity(data: { name: string; slug: string; description?: string; icon?: string; creatorId: number }) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(communities).values({
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    icon: data.icon || null,
    memberCount: 1,
  });
  // Auto-join creator
  if (result.insertId) {
    await db.insert(communityMembers).values({ communityId: result.insertId, userId: data.creatorId, role: 'moderator' });
  }
  return result.insertId;
}

// ============ REVIEWS ============

export async function createReview(data: InsertReview) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(reviews).values(data);
  return result.insertId;
}

export async function getReviewsBySeller(sellerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.sellerId, sellerId)).orderBy(desc(reviews.createdAt));
}

export async function getAverageRating(sellerId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ avg: sql<number>`AVG(${reviews.rating})`, count: sql<number>`COUNT(*)` })
    .from(reviews).where(eq(reviews.sellerId, sellerId));
  const row = result[0];
  return { avg: Number(row.avg ?? 0), count: Number(row.count ?? 0) };
}

export async function hasReviewedByBuyer(listingId: number, reviewerId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(reviews)
    .where(and(eq(reviews.listingId, listingId), eq(reviews.reviewerId, reviewerId)))
    .limit(1);
  return result.length > 0;
}

// ============ BADGES ============

export async function getUserBadges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userBadges).where(eq(userBadges.userId, userId)).orderBy(userBadges.earnedAt);
}

export async function earnBadge(userId: number, badgeType: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(userBadges)
    .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeType, badgeType as any)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(userBadges).values({ userId, badgeType: badgeType as any });
  }
}

export async function checkAndAwardBadges(userId: number) {
  const db = await getDb();
  if (!db) return;
  // Check first_post
  const postCount = await db.select({ count: sql<number>`COUNT(*)` }).from(posts).where(eq(posts.authorId, userId));
  if (postCount && (postCount[0]?.count ?? 0) >= 1) await earnBadge(userId, 'first_post');
  if (postCount && (postCount[0]?.count ?? 0) >= 10) await earnBadge(userId, 'bookworm');
  
  const commentCount = await db.select({ count: sql<number>`COUNT(*)` }).from(comments).where(eq(comments.authorId, userId));
  if (commentCount && (commentCount[0]?.count ?? 0) >= 1) await earnBadge(userId, 'first_comment');
  if (commentCount && (commentCount[0]?.count ?? 0) >= 50) await earnBadge(userId, 'top_contributor');
  
  const saleCount = await db.select({ count: sql<number>`COUNT(*)` }).from(listings).where(and(eq(listings.authorId, userId), eq(listings.status, 'sold' as any)));
  if (saleCount && (saleCount[0]?.count ?? 0) >= 1) await earnBadge(userId, 'first_sale');
  if (saleCount && (saleCount[0]?.count ?? 0) >= 5) await earnBadge(userId, 'verified_seller');
  
  const listingCount = await db.select({ count: sql<number>`COUNT(*)` }).from(listings).where(eq(listings.authorId, userId));
  if (listingCount && (listingCount[0]?.count ?? 0) >= 3) await earnBadge(userId, 'collector');
}

// ============ NOTIFICATIONS ============

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(notifications).values(data);
  return result.insertId;
}

export async function getUserNotifications(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationRead(notificationId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function getUnreadCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(result[0]?.count ?? 0);
}

// ============ FEATURED LISTINGS ============

export async function createFeaturedListing(data: InsertFeaturedListing) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(featuredListings).values(data);
  return result.insertId;
}

export async function getActiveFeaturedListings() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(featuredListings)
    .where(and(eq(featuredListings.isActive, true), lte(featuredListings.startsAt, now), gte(featuredListings.endsAt, now)));
}

export async function isListingFeatured(listingId: number) {
  const featured = await getActiveFeaturedListings();
  return featured.some(f => f.listingId === listingId);
}

// ============ MARKETPLACE FILTERS ============

export async function listListingsWithFilters(options: {
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  query?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(listings.status, (options.status || 'active') as any)];
  if (options.minPrice !== undefined) conditions.push(sql`${listings.price} >= ${options.minPrice}`);
  if (options.maxPrice !== undefined) conditions.push(sql`${listings.price} <= ${options.maxPrice}`);
  if (options.condition) conditions.push(eq(listings.condition, options.condition as any));
  if (options.query) {
    const q = `%${options.query}%`;
    conditions.push(sql`(${listings.title} LIKE ${q} OR ${listings.bookTitle} LIKE ${q} OR ${listings.author} LIKE ${q})`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(listings)
    .where(whereClause)
    .orderBy(desc(listings.createdAt))
    .limit(options.limit || 20)
    .offset(options.offset || 0);
}
export async function getFeaturedListingByStripeId(stripeSessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(featuredListings)
    .where(eq(featuredListings.stripeSessionId, stripeSessionId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function activateFeaturedListing(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(featuredListings).set({ isActive: true }).where(eq(featuredListings.id, id));
}


// ============ BOOKS ============
export async function createBook(data: InsertBook) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(books).values(data);
  return result.insertId;
}
// Versão pública (sem restrição de admin) para importação via APIs externas
export async function createBookPublic(data: Omit<InsertBook, 'id' | 'createdAt' | 'updatedAt' | 'averageRating' | 'ratingCount'>) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(books).values({ ...data, averageRating: 0, ratingCount: 0 });
  return result.insertId;
}

export async function getBookById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getBookByISBN(isbn: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(books).where(eq(books.isbn, isbn)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function searchBooks(query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query}%`;
  try {
    const result = await db.select().from(books)
      .where(sql`MATCH(${books.title}, ${books.author}, ${books.description}) AGAINST(${query} IN NATURAL LANGUAGE MODE)`)
      .limit(limit);
    if (result.length > 0) return result;
  } catch {
    // FULLTEXT index not present yet (see drizzle/manual/0002_fulltext_indexes.sql) — fall through to LIKE.
  }
  return db.select().from(books)
    .where(sql`(${books.title} LIKE ${q} OR ${books.author} LIKE ${q})`)
    .limit(limit);
}

export async function listBooks(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(books)
    .orderBy(desc(books.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateBookRating(bookId: number, newRating: number, ratingCount: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(books)
    .set({ averageRating: newRating, ratingCount })
    .where(eq(books.id, bookId));
}

// ============ USER READING LIST ============
export async function addToReadingList(data: InsertUserReadingListItem) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(userReadingList).values(data);
  return result.insertId;
}

export async function getUserReadingList(userId: number, status?: 'read' | 'reading' | 'want_to_read') {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(userReadingList.userId, userId)];
  if (status) conditions.push(eq(userReadingList.status, status as any));
  return db.select().from(userReadingList)
    .where(and(...conditions))
    .orderBy(desc(userReadingList.updatedAt));
}
export async function getUserReadingListWithBooks(userId: number, status?: 'read' | 'reading' | 'want_to_read') {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(userReadingList.userId, userId)];
  if (status) conditions.push(eq(userReadingList.status, status as any));
  const items = await db.select().from(userReadingList)
    .where(and(...conditions))
    .orderBy(desc(userReadingList.updatedAt));
  return Promise.all(items.map(async (item) => {
    const book = await getBookById(item.bookId);
    return { ...item, book };
  }));
}

export async function updateReadingListItem(id: number, data: Partial<InsertUserReadingListItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(userReadingList).set(data).where(eq(userReadingList.id, id));
}

export async function removeFromReadingList(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userReadingList).where(eq(userReadingList.id, id));
}

export async function getUserReadingStats(userId: number) {
  const db = await getDb();
  if (!db) return { read: 0, reading: 0, wantToRead: 0 };
  const result = await db.select({
    status: userReadingList.status,
    count: sql<number>`COUNT(*)`,
  }).from(userReadingList)
    .where(eq(userReadingList.userId, userId))
    .groupBy(userReadingList.status);
  
  const stats = { read: 0, reading: 0, wantToRead: 0 };
  for (const row of result) {
    if (row.status === 'read') stats.read = Number(row.count);
    if (row.status === 'reading') stats.reading = Number(row.count);
    if (row.status === 'want_to_read') stats.wantToRead = Number(row.count);
  }
  return stats;
}

// ============ READING GOALS ============
export async function createReadingGoal(data: InsertReadingGoal) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(readingGoals).values(data);
  return result.insertId;
}

export async function getUserReadingGoal(userId: number, year: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(readingGoals)
    .where(and(eq(readingGoals.userId, userId), eq(readingGoals.year, year)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateReadingGoalProgress(goalId: number, booksRead: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(readingGoals).set({ booksRead }).where(eq(readingGoals.id, goalId));
}

// ============ BOOK MENTIONS ============
export async function recordBookMention(data: InsertBookMention) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(bookMentions).values(data);
  return result.insertId;
}

export async function getBookMentionCount(bookId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(bookMentions)
    .where(eq(bookMentions.bookId, bookId));
  return Number(result[0]?.count ?? 0);
}

export async function getMostMentionedBooks(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    book: books,
    mentionCount: sql<number>`COUNT(${bookMentions.id})`,
  })
    .from(bookMentions)
    .innerJoin(books, eq(bookMentions.bookId, books.id))
    .groupBy(bookMentions.bookId)
    .orderBy(sql`COUNT(${bookMentions.id}) DESC`)
    .limit(limit);
}

// ============ BOOK REVIEWS ============
export async function createBookReview(data: InsertBookReview) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(bookReviews).values(data);
  
  // Update book's average rating
  const allReviews = await db.select({
    avgRating: sql<number>`AVG(${bookReviews.rating})`,
    count: sql<number>`COUNT(*)`,
  }).from(bookReviews).where(eq(bookReviews.bookId, data.bookId));
  
  if (allReviews[0]) {
    await updateBookRating(
      data.bookId,
      Number(allReviews[0].avgRating) || 0,
      Number(allReviews[0].count) || 0
    );
  }
  
  return result.insertId;
}

export async function getBookReviews(bookId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookReviews)
    .where(eq(bookReviews.bookId, bookId))
    .orderBy(desc(bookReviews.upvotes), desc(bookReviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getUserBookReview(userId: number, bookId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(bookReviews)
    .where(and(eq(bookReviews.userId, userId), eq(bookReviews.bookId, bookId)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============ BOOK RECOMMENDATIONS ============
export async function createBookRecommendation(data: InsertBookRecommendation) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(bookRecommendations).values(data);
  return result.insertId;
}

export async function getUserRecommendations(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    recommendation: bookRecommendations,
    book: books,
  })
    .from(bookRecommendations)
    .innerJoin(books, eq(bookRecommendations.bookId, books.id))
    .where(eq(bookRecommendations.userId, userId))
    .orderBy(desc(bookRecommendations.score))
    .limit(limit);
}

export async function clearUserRecommendations(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(bookRecommendations).where(eq(bookRecommendations.userId, userId));
}

// ============ USER FAVORITE GENRES ============
export async function addFavoriteGenre(userId: number, genre: string) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(userFavoriteGenres).values({ userId, genre });
  return result.insertId;
}

export async function getUserFavoriteGenres(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userFavoriteGenres)
    .where(eq(userFavoriteGenres.userId, userId));
}

export async function removeFavoriteGenre(userId: number, genre: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userFavoriteGenres)
    .where(and(eq(userFavoriteGenres.userId, userId), eq(userFavoriteGenres.genre, genre)));
}
