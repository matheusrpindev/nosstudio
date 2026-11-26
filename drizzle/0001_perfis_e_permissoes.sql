CREATE TABLE `client_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`added_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_users_client_user_idx` ON `client_users` (`client_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `client_users_user_idx` ON `client_users` (`user_id`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`can_view` integer DEFAULT true NOT NULL,
	`can_edit` integer DEFAULT false NOT NULL,
	`can_download` integer DEFAULT false NOT NULL,
	`can_upload` integer DEFAULT false NOT NULL,
	`added_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_members_project_user_idx` ON `project_members` (`project_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `project_members_user_idx` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`client_id` integer,
	`project_id` integer,
	`project_role` text DEFAULT '' NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`invited_by` integer,
	`accepted_at` integer,
	`accepted_user_id` integer,
	`revoked_at` integer,
	`revoked_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`accepted_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_invites_token_hash_unique` ON `user_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `user_invites_email_idx` ON `user_invites` (`email`);--> statement-breakpoint
ALTER TABLE `users` ADD `permissions` text DEFAULT '{"grant":[],"deny":[]}' NOT NULL;