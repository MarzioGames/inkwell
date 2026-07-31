CREATE TABLE `banned_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reason` text,
	`bannedById` int NOT NULL,
	`unbanAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `banned_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `banned_users_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int,
	`actionType` enum('dismiss','delete_content','warn','ban_user') NOT NULL,
	`targetType` enum('post','comment','listing','user') NOT NULL,
	`targetId` int NOT NULL,
	`moderatorId` int NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetType` enum('post','comment','listing','user') NOT NULL,
	`targetId` int NOT NULL,
	`reporterId` int NOT NULL,
	`reason` enum('spam','harassment','hate_speech','misinformation','nsfw','copyright','other') NOT NULL,
	`description` text,
	`status` enum('pending','reviewed','resolved','dismissed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `checkout_sessions` ADD `deliveryConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);