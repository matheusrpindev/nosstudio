CREATE TABLE `visit_salts` (
	`day` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visit_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`started_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`pageviews` integer DEFAULT 1 NOT NULL,
	`entry_path` text DEFAULT '/' NOT NULL,
	`source` text DEFAULT 'direto' NOT NULL,
	`referrer_host` text DEFAULT '' NOT NULL,
	`campaign` text DEFAULT '' NOT NULL,
	`device` text DEFAULT 'computador' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visit_sessions_visitor_idx` ON `visit_sessions` (`day`,`visitor_hash`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `visit_sessions_started_idx` ON `visit_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `visit_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`dimension` text NOT NULL,
	`key` text DEFAULT '' NOT NULL,
	`visits` integer DEFAULT 0 NOT NULL,
	`visitors` integer DEFAULT 0 NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visit_stats_day_dimension_key_idx` ON `visit_stats` (`day`,`dimension`,`key`);--> statement-breakpoint
CREATE INDEX `visit_stats_dimension_day_idx` ON `visit_stats` (`dimension`,`day`);