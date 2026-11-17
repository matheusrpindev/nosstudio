CREATE TABLE `agenda_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'outro' NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text DEFAULT '' NOT NULL,
	`client_id` integer,
	`project_id` integer,
	`owner_id` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `agenda_date_idx` ON `agenda_events` (`date`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message` text NOT NULL,
	`link_label` text,
	`link_url` text,
	`bg_color` text DEFAULT 'roxo' NOT NULL,
	`text_color` text DEFAULT 'branco' NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`enabled` integer DEFAULT false NOT NULL,
	`dismissible` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`user_name` text,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`summary` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `brand_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text DEFAULT 'outro' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`media_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `client_interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`user_id` integer,
	`kind` text DEFAULT 'nota' NOT NULL,
	`content` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `interactions_client_idx` ON `client_interactions` (`client_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'pf' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`segment` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'outro' NOT NULL,
	`service_interest` text DEFAULT 'outro' NOT NULL,
	`owner_id` integer,
	`status` text DEFAULT 'novo_contato' NOT NULL,
	`lost_reason` text DEFAULT '' NOT NULL,
	`first_contact_at` text,
	`next_step` text DEFAULT '' NOT NULL,
	`next_step_date` text,
	`important_dates` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `clients_status_idx` ON `clients` (`status`);--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`client_id` integer,
	`network` text DEFAULT 'instagram' NOT NULL,
	`format` text DEFAULT 'reels' NOT NULL,
	`status` text DEFAULT 'ideia' NOT NULL,
	`idea_notes` text DEFAULT '' NOT NULL,
	`script` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`cta` text DEFAULT '' NOT NULL,
	`record_date` text,
	`edit_deadline` text,
	`publish_date` text,
	`approval_status` text DEFAULT 'pendente' NOT NULL,
	`owner_id` integer,
	`asset_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_status_idx` ON `content_items` (`status`);--> statement-breakpoint
CREATE INDEX `content_publish_idx` ON `content_items` (`publish_date`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'outro' NOT NULL,
	`is_template` integer DEFAULT false NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`version_label` text DEFAULT '' NOT NULL,
	`client_id` integer,
	`project_id` integer,
	`proposal_id` integer,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`signed_at` text,
	`valid_from` text,
	`valid_until` text,
	`file_media_id` integer,
	`external_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`file_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contracts_client_idx` ON `contracts` (`client_id`);--> statement-breakpoint
CREATE INDEX `contracts_template_idx` ON `contracts` (`is_template`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`show_on_home` integer DEFAULT false NOT NULL,
	`show_on_weddings` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `finance_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`installment_label` text DEFAULT '' NOT NULL,
	`method` text,
	`supplier` text DEFAULT '' NOT NULL,
	`client_id` integer,
	`project_id` integer,
	`proposal_id` integer,
	`receipt_media_id` integer,
	`receipt_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`receipt_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `finance_due_idx` ON `finance_entries` (`due_date`);--> statement-breakpoint
CREATE INDEX `finance_type_idx` ON `finance_entries` (`type`,`paid_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`whatsapp` text NOT NULL,
	`email` text,
	`service_interest` text DEFAULT 'outro' NOT NULL,
	`event_date` text,
	`city` text,
	`message` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`source` text DEFAULT 'site' NOT NULL,
	`origin_path` text,
	`consent_at` integer,
	`consent_version` text,
	`status` text DEFAULT 'novo' NOT NULL,
	`client_id` integer,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`storage_key` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`mime` text NOT NULL,
	`original_name` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`alt` text DEFAULT '' NOT NULL,
	`variants` text DEFAULT '[]' NOT NULL,
	`placeholder_color` text,
	`uploaded_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_storage_key_unique` ON `media` (`storage_key`);--> statement-breakpoint
CREATE INDEX `media_visibility_idx` ON `media` (`visibility`);--> statement-breakpoint
CREATE TABLE `packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'plano' NOT NULL,
	`name` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`includes` text DEFAULT '[]' NOT NULL,
	`deliverables` text DEFAULT '[]' NOT NULL,
	`recording_duration` text DEFAULT '' NOT NULL,
	`revision_limit` text DEFAULT '' NOT NULL,
	`price_mode` text DEFAULT 'sob_consulta' NOT NULL,
	`price_cents` integer,
	`price_suffix` text DEFAULT '' NOT NULL,
	`recommended` integer DEFAULT false NOT NULL,
	`cta_label` text DEFAULT 'Solicitar orçamento' NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `password_reset_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `portfolio_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`client_name` text DEFAULT '' NOT NULL,
	`show_client` integer DEFAULT false NOT NULL,
	`category` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`services_done` text DEFAULT '[]' NOT NULL,
	`cover_media_id` integer,
	`gallery` text DEFAULT '[]' NOT NULL,
	`video_url` text,
	`project_date` text,
	`published` integer DEFAULT false NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_projects_slug_unique` ON `portfolio_projects` (`slug`);--> statement-breakpoint
CREATE INDEX `portfolio_published_idx` ON `portfolio_projects` (`published`,`category`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer,
	`proposal_id` integer,
	`title` text NOT NULL,
	`service_type` text DEFAULT 'outro' NOT NULL,
	`stage` text DEFAULT 'briefing' NOT NULL,
	`owner_id` integer,
	`location` text DEFAULT '' NOT NULL,
	`event_date` text,
	`shoot_deadline` text,
	`delivery_deadline` text,
	`delivered_at` text,
	`checklist` text DEFAULT '[]' NOT NULL,
	`drive_url` text DEFAULT '' NOT NULL,
	`gallery_url` text DEFAULT '' NOT NULL,
	`references_url` text DEFAULT '' NOT NULL,
	`final_files_url` text DEFAULT '' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`backup_status` text DEFAULT 'pendente' NOT NULL,
	`backup_note` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `projects_stage_idx` ON `projects` (`stage`);--> statement-breakpoint
CREATE INDEX `projects_client_idx` ON `projects` (`client_id`);--> statement-breakpoint
CREATE TABLE `proposal_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proposal_id` integer NOT NULL,
	`category` text DEFAULT 'outros' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_costs_proposal_idx` ON `proposal_costs` (`proposal_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `proposal_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proposal_id` integer NOT NULL,
	`kind` text DEFAULT 'incluso' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_items_proposal_idx` ON `proposal_items` (`proposal_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `proposal_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proposal_id` integer NOT NULL,
	`label` text NOT NULL,
	`due_date` text,
	`due_label` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_payments_proposal_idx` ON `proposal_payments` (`proposal_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`root_id` integer,
	`is_template` integer DEFAULT false NOT NULL,
	`template_name` text DEFAULT '' NOT NULL,
	`modality` text DEFAULT 'personalizada' NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`client_id` integer,
	`client_display_name` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`owner_id` integer,
	`title` text NOT NULL,
	`event_date` text,
	`event_location` text DEFAULT '' NOT NULL,
	`valid_until` text,
	`intro` text DEFAULT '' NOT NULL,
	`schedule_text` text DEFAULT '' NOT NULL,
	`exclusions` text DEFAULT '' NOT NULL,
	`payment_notes` text DEFAULT '' NOT NULL,
	`conditions` text DEFAULT '' NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`discount_label` text DEFAULT '' NOT NULL,
	`discount_approved` integer DEFAULT false NOT NULL,
	`show_item_prices` integer DEFAULT false NOT NULL,
	`entry_mode` text DEFAULT 'percentual' NOT NULL,
	`entry_percent` real DEFAULT 0 NOT NULL,
	`entry_cents` integer DEFAULT 0 NOT NULL,
	`internal_notes` text DEFAULT '' NOT NULL,
	`overhead_cents` integer DEFAULT 0 NOT NULL,
	`tax_percent` real DEFAULT 0 NOT NULL,
	`target_margin_percent` real DEFAULT 0 NOT NULL,
	`sent_at` integer,
	`responded_at` integer,
	`project_id` integer,
	`contract_id` integer,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_number_version_idx` ON `proposals` (`number`,`version`);--> statement-breakpoint
CREATE INDEX `proposals_status_idx` ON `proposals` (`is_template`,`status`);--> statement-breakpoint
CREATE INDEX `proposals_client_idx` ON `proposals` (`client_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`blocked_until` integer
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`cta_label` text DEFAULT 'Solicitar orçamento' NOT NULL,
	`interest` text DEFAULT 'outro' NOT NULL,
	`cover_media_id` integer,
	`gallery` text DEFAULT '[]' NOT NULL,
	`video_url` text,
	`page_path` text,
	`visible` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_slug_unique` ON `services` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`user_agent` text,
	`ip` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `site_content` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`due_date` text,
	`owner_id` integer,
	`priority` text DEFAULT 'normal' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_at` integer,
	`client_id` integer,
	`project_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`done`,`due_date`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'texto' NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`author_role` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`media_id` integer,
	`media_alt` text DEFAULT '' NOT NULL,
	`video_url` text,
	`authorized` integer DEFAULT false NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);