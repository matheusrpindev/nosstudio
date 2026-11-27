ALTER TABLE `packages` ADD `base_package_id` integer;--> statement-breakpoint
ALTER TABLE `packages` ADD `optionals` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `discount_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `benefits` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `faq` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `related_project_ids` text DEFAULT '[]' NOT NULL;