CREATE TABLE `agenda_calendars` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text,
	`name` text NOT NULL,
	`kind` text DEFAULT 'geral' NOT NULL,
	`user_id` integer,
	`color` text DEFAULT 'roxo' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agenda_calendars_slug_unique` ON `agenda_calendars` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `agenda_calendars_user_idx` ON `agenda_calendars` (`user_id`);--> statement-breakpoint
CREATE TABLE `agenda_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text,
	`name` text NOT NULL,
	`color` text DEFAULT 'roxo' NOT NULL,
	`icon` text DEFAULT 'calendar' NOT NULL,
	`blocks_day` integer DEFAULT false NOT NULL,
	`is_production` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agenda_categories_slug_unique` ON `agenda_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `agenda_checklist_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category_id` integer,
	`items` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `agenda_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `agenda_event_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer,
	`role` text DEFAULT 'participante' NOT NULL,
	`external_name` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `agenda_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agenda_people_event_user_idx` ON `agenda_event_people` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `agenda_people_user_idx` ON `agenda_event_people` (`user_id`);--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `category_id` integer REFERENCES agenda_categories(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `calendar_id` integer REFERENCES agenda_calendars(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `map_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `meeting_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `status` text DEFAULT 'confirmado' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `visibility` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `checklist` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `reminders` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `recurrence` text;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `recurrence_exceptions` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `series_id` integer REFERENCES agenda_events(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `original_date` text;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `attachments` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `production` text;--> statement-breakpoint
ALTER TABLE `agenda_events` ADD `created_by` integer REFERENCES users(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `agenda_series_idx` ON `agenda_events` (`series_id`);--> statement-breakpoint
CREATE INDEX `agenda_calendar_idx` ON `agenda_events` (`calendar_id`);--> statement-breakpoint
CREATE INDEX `agenda_category_idx` ON `agenda_events` (`category_id`);--> statement-breakpoint
-- ---------------------------------------------------------------------------------------------
-- Dados: categorias e agendas iniciais (as mesmas de AGENDA_DEFAULT_CATEGORIES / AGENDA_DEFAULT_CALENDARS
-- em src/lib/domain.ts) e conversão dos compromissos antigos (coluna `kind`) para categorias.
-- ---------------------------------------------------------------------------------------------
INSERT INTO `agenda_categories` (`slug`, `name`, `color`, `icon`, `blocks_day`, `is_production`, `sort_order`) VALUES
	('reunioes-internas', 'Reuniões internas', 'lavanda', 'users', 0, 0, 10),
	('reunioes-clientes', 'Reuniões com clientes', 'roxo', 'handshake', 0, 0, 20),
	('prospeccao', 'Prospecção comercial', 'amarelo', 'megaphone', 0, 0, 30),
	('gravacoes', 'Gravações', 'lima', 'video', 0, 1, 40),
	('sessoes-fotograficas', 'Sessões fotográficas', 'verde', 'camera', 0, 1, 50),
	('eventos', 'Eventos', 'laranja', 'party-popper', 0, 1, 60),
	('casamentos', 'Casamentos', 'rosa', 'heart', 0, 1, 70),
	('edicao', 'Edição e pós-produção', 'azul', 'scissors', 0, 0, 80),
	('publicacoes', 'Publicações', 'ciano', 'send', 0, 0, 90),
	('entregas', 'Entregas', 'verde', 'package-check', 0, 0, 100),
	('aprovacoes', 'Aprovações', 'lavanda', 'circle-check', 0, 0, 110),
	('prazos-contratuais', 'Prazos contratuais', 'vermelho', 'file-clock', 0, 0, 120),
	('pagamentos', 'Pagamentos', 'amarelo', 'banknote', 0, 0, 130),
	('compromissos-financeiros', 'Compromissos financeiros', 'laranja', 'landmark', 0, 0, 140),
	('pessoais', 'Compromissos pessoais', 'cinza', 'user', 0, 0, 150),
	('ferias', 'Férias e indisponibilidade', 'cinza', 'tree-palm', 1, 0, 160),
	('outros', 'Outros', 'cinza', 'calendar', 0, 0, 170);
--> statement-breakpoint
INSERT INTO `agenda_calendars` (`slug`, `name`, `kind`, `color`, `sort_order`) VALUES
	('geral', 'Agenda geral da NÓS', 'geral', 'roxo', 10),
	('producoes', 'Produções', 'producoes', 'lima', 100),
	('comercial', 'Comercial', 'comercial', 'amarelo', 110),
	('financeira', 'Financeira', 'financeira', 'verde', 120),
	('editorial', 'Editorial', 'editorial', 'ciano', 130),
	('colaboradores', 'Colaboradores', 'colaboradores', 'laranja', 140);
--> statement-breakpoint
-- uma agenda pessoal para cada conta ativa que entra no painel (as demais nascem sob demanda)
INSERT INTO `agenda_calendars` (`name`, `kind`, `user_id`, `color`, `sort_order`)
SELECT `name`, 'pessoal', `id`,
	CASE (row_number() OVER (ORDER BY `id`) - 1) % 6
		WHEN 0 THEN 'lavanda' WHEN 1 THEN 'rosa' WHEN 2 THEN 'azul' WHEN 3 THEN 'ciano' WHEN 4 THEN 'laranja' ELSE 'verde' END,
	20 + row_number() OVER (ORDER BY `id`)
FROM `users`
WHERE `active` = 1 AND `role` IN ('admin', 'socio', 'gestor', 'tecnico', 'funcionario');
--> statement-breakpoint
-- tipo antigo → categoria (reunião com cliente vinculado vira "Reuniões com clientes"); gravações e eventos
-- vão para a agenda de Produções, o resto para a geral; quem era o responsável passa a ser também o criador
UPDATE `agenda_events` SET
	`category_id` = (SELECT `id` FROM `agenda_categories` WHERE `slug` = CASE `agenda_events`.`kind`
		WHEN 'gravacao' THEN 'gravacoes'
		WHEN 'evento' THEN 'eventos'
		WHEN 'reuniao' THEN CASE WHEN `agenda_events`.`client_id` IS NULL THEN 'reunioes-internas' ELSE 'reunioes-clientes' END
		WHEN 'entrega' THEN 'entregas'
		ELSE 'outros' END),
	`calendar_id` = (SELECT `id` FROM `agenda_calendars` WHERE `slug` = CASE WHEN `agenda_events`.`kind` IN ('gravacao', 'evento') THEN 'producoes' ELSE 'geral' END),
	`created_by` = `owner_id`;
--> statement-breakpoint
INSERT INTO `agenda_event_people` (`event_id`, `user_id`, `role`)
SELECT `id`, `owner_id`, 'responsavel' FROM `agenda_events` WHERE `owner_id` IS NOT NULL;
