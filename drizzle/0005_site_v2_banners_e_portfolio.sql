CREATE TABLE `banners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`layout` text DEFAULT 'tipografico' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`button_label` text DEFAULT '' NOT NULL,
	`button_url` text DEFAULT '' NOT NULL,
	`secondary_label` text DEFAULT '' NOT NULL,
	`secondary_url` text DEFAULT '' NOT NULL,
	`desktop_media_id` integer,
	`mobile_media_id` integer,
	`video_media_id` integer,
	`alt` text DEFAULT '' NOT NULL,
	`bg_color` text DEFAULT 'roxo' NOT NULL,
	`tone` text DEFAULT 'claro' NOT NULL,
	`duration_seconds` integer DEFAULT 7 NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`enabled` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`desktop_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`mobile_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`video_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `announcements` ADD `pages` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `extra_video_urls` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `objective` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `challenge` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `solution` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `results` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `before_after` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `backstage` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `related_project_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `origin` text DEFAULT 'nos' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD `origin_note` text DEFAULT '' NOT NULL;