import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, bigint, float } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User profiles with avatar, bio, karma
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  karma: int("karma").default(0).notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Book communities
 */
export const communities = mysqlTable("communities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  memberCount: int("memberCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Community = typeof communities.$inferSelect;
export type InsertCommunity = typeof communities.$inferInsert;

/**
 * Posts in the feed
 */
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("communityId").notNull(),
  authorId: int("authorId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  content: text("content"),
  linkUrl: varchar("linkUrl", { length: 512 }),
  type: mysqlEnum("type", ["text", "link"]).default("text").notNull(),
  upvotes: int("upvotes").default(0).notNull(),
  downvotes: int("downvotes").default(0).notNull(),
  commentCount: int("commentCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

/**
 * Comments on posts (nested via parentId)
 */
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  authorId: int("authorId").notNull(),
  parentId: int("parentId"),
  content: text("content").notNull(),
  upvotes: int("upvotes").default(0).notNull(),
  downvotes: int("downvotes").default(0).notNull(),
  depth: int("depth").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * Votes on posts and comments
 */
export const votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  targetType: mysqlEnum("targetType", ["post", "comment"]).notNull(),
  targetId: int("targetId").notNull(),
  value: mysqlEnum("value", ["up", "down"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

/**
 * Marketplace listings (used books for sale)
 */
export const listings = mysqlTable("listings", {
  id: int("id").autoincrement().primaryKey(),
  authorId: int("authorId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  bookTitle: varchar("bookTitle", { length: 256 }).notNull(),
  author: varchar("author", { length: 256 }).notNull(),
  price: float("price").notNull(),
  condition: mysqlEnum("condition", ["new", "like_new", "good", "fair", "poor"]).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  status: mysqlEnum("status", ["active", "sold", "removed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Listing = typeof listings.$inferSelect;
export type InsertListing = typeof listings.$inferInsert;

/**
 * Chat rooms (tied to a listing)
 */
export const chatRooms = mysqlTable("chat_rooms", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  buyerId: int("buyerId").notNull(),
  sellerId: int("sellerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = typeof chatRooms.$inferInsert;

/**
 * Chat messages
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Stripe checkout sessions for listing purchases
 */
export const checkoutSessions = mysqlTable("checkout_sessions", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  buyerId: int("buyerId").notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "expired"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  deliveryConfirmedAt: timestamp("deliveryConfirmedAt"),
});

export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type InsertCheckoutSession = typeof checkoutSessions.$inferInsert;

/**
 * Reports: users flagging posts/comments/listings for moderation review
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  targetType: mysqlEnum("targetType", ["post", "comment", "listing", "user"]).notNull(),
  targetId: int("targetId").notNull(),
  reporterId: int("reporterId").notNull(),
  reason: mysqlEnum("reason", [
    "spam", "harassment", "hate_speech", "misinformation", "nsfw", "copyright", "other"
  ]).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved", "dismissed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Moderation actions: audit trail of what a moderator/admin did and why
 */
export const moderationActions = mysqlTable("moderation_actions", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId"),
  actionType: mysqlEnum("actionType", ["dismiss", "delete_content", "warn", "ban_user"]).notNull(),
  targetType: mysqlEnum("targetType", ["post", "comment", "listing", "user"]).notNull(),
  targetId: int("targetId").notNull(),
  moderatorId: int("moderatorId").notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = typeof moderationActions.$inferInsert;

/**
 * Active bans. One row per currently-banned user; cleared/expired bans are deleted.
 */
export const bannedUsers = mysqlTable("banned_users", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  reason: text("reason"),
  bannedById: int("bannedById").notNull(),
  unbanAt: timestamp("unbanAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BannedUser = typeof bannedUsers.$inferSelect;
export type InsertBannedUser = typeof bannedUsers.$inferInsert;

/**
 * Favorites: users can save posts and listings
 */
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  targetType: mysqlEnum("targetType", ["post", "listing"]).notNull(),
  targetId: int("targetId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

/**
 * Community memberships
 */
export const communityMembers = mysqlTable("community_members", {
  id: int("id").autoincrement().primaryKey(),
  communityId: int("communityId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["member", "moderator"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type CommunityMember = typeof communityMembers.$inferSelect;
export type InsertCommunityMember = typeof communityMembers.$inferInsert;

/**
 * Reviews for marketplace sellers
 */
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  sellerId: int("sellerId").notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

/**
 * User badges/achievements
 */
export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  badgeType: mysqlEnum("badgeType", [
    "first_post", "first_sale", "first_comment", "top_contributor",
    "verified_seller", "community_leader", "collector", "bookworm"
  ]).notNull(),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

/**
 * Notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "chat_message", "post_upvote", "comment_reply", "listing_sold", "new_follower"
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 512 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Featured listings (paid boost via Stripe)
 */
export const featuredListings = mysqlTable("featured_listings", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeaturedListing = typeof featuredListings.$inferSelect;
export type InsertFeaturedListing = typeof featuredListings.$inferInsert;

/**
 * Books - Central entity for the platform
 */
export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  isbn: varchar("isbn", { length: 20 }).unique(),
  title: varchar("title", { length: 256 }).notNull(),
  author: varchar("author", { length: 256 }).notNull(),
  description: text("description"),
  genre: varchar("genre", { length: 128 }),
  coverUrl: text("coverUrl"),
  publishedYear: int("publishedYear"),
  publisher: varchar("publisher", { length: 256 }),
  pageCount: int("pageCount"),
  averageRating: float("averageRating").default(0).notNull(),
  ratingCount: int("ratingCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

/**
 * User reading list - Track books read, reading, want to read
 */
export const userReadingList = mysqlTable("user_reading_list", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookId: int("bookId").notNull(),
  status: mysqlEnum("status", ["read", "reading", "want_to_read"]).notNull(),
  rating: int("rating"), // 1-5 stars, only if status is "read"
  review: text("review"),
  dateStarted: timestamp("dateStarted"),
  dateFinished: timestamp("dateFinished"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserReadingListItem = typeof userReadingList.$inferSelect;
export type InsertUserReadingListItem = typeof userReadingList.$inferInsert;

/**
 * Reading goals - Annual reading targets
 */
export const readingGoals = mysqlTable("reading_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  targetBooks: int("targetBooks").notNull(),
  booksRead: int("booksRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type InsertReadingGoal = typeof readingGoals.$inferInsert;

/**
 * Book mentions - Track when books are mentioned in posts/comments
 */
export const bookMentions = mysqlTable("book_mentions", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull(),
  postId: int("postId"),
  commentId: int("commentId"),
  mentionedAt: timestamp("mentionedAt").defaultNow().notNull(),
});

export type BookMention = typeof bookMentions.$inferSelect;
export type InsertBookMention = typeof bookMentions.$inferInsert;

/**
 * Book recommendations - AI-generated personalized recommendations
 */
export const bookRecommendations = mysqlTable("book_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookId: int("bookId").notNull(),
  reason: varchar("reason", { length: 256 }), // e.g., "Similar to books you liked"
  score: float("score").notNull(), // 0-1 confidence score
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BookRecommendation = typeof bookRecommendations.$inferSelect;
export type InsertBookRecommendation = typeof bookRecommendations.$inferInsert;

/**
 * Book reviews - Detailed reviews separate from reading list ratings
 */
export const bookReviews = mysqlTable("book_reviews", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(), // 1-5 stars
  title: varchar("title", { length: 256 }),
  content: text("content"),
  upvotes: int("upvotes").default(0).notNull(),
  downvotes: int("downvotes").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BookReview = typeof bookReviews.$inferSelect;
export type InsertBookReview = typeof bookReviews.$inferInsert;

/**
 * User favorite genres - For personalized recommendations
 */
export const userFavoriteGenres = mysqlTable("user_favorite_genres", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  genre: varchar("genre", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserFavoriteGenre = typeof userFavoriteGenres.$inferSelect;
export type InsertUserFavoriteGenre = typeof userFavoriteGenres.$inferInsert;
