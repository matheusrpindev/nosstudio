/**
 * Schema do banco (SQLite / libSQL via Drizzle).
 *
 * Convenções:
 * - Dinheiro: sempre em centavos (integer). Nunca float.
 * - Datas "de calendário" (vencimento, data do evento, prazo): texto ISO `YYYY-MM-DD` — sem fuso horário.
 * - Horários de agenda: texto `HH:mm` (horário local do estúdio).
 * - Instantes (criado em, enviado em): integer em milissegundos (`timestamp_ms` → Date).
 * - Listas pequenas e estruturas livres: colunas JSON tipadas com `$type`.
 * - Enums: listas em `src/lib/domain.ts` (fonte única, com rótulos em pt-BR).
 */
import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  AGENDA_CALENDAR_KINDS,
  AGENDA_COLORS,
  AGENDA_ICONS,
  AGENDA_KINDS,
  AGENDA_PERSON_ROLES,
  AGENDA_PRIORITIES,
  AGENDA_REMINDER_CHANNELS,
  AGENDA_STATUSES,
  AGENDA_VISIBILITIES,
  APPROVAL_STATUSES,
  BACKUP_STATUSES,
  BANNER_LAYOUTS,
  BANNER_TONES,
  BRAND_ASSET_CATEGORIES,
  BRAND_COLORS,
  CLIENT_KINDS,
  CLIENT_STATUSES,
  CONTACT_SOURCES,
  CONTENT_FORMATS,
  CONTENT_NETWORKS,
  CONTENT_STATUSES,
  CONTRACT_KINDS,
  CONTRACT_STATUSES,
  ENTRY_MODES,
  FINANCE_CATEGORIES,
  FINANCE_TYPES,
  INTERACTION_KINDS,
  LEAD_STATUSES,
  MEDIA_VISIBILITIES,
  NOTIFICATION_TYPES,
  PACKAGE_KINDS,
  PAYMENT_METHODS,
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_ORIGINS,
  PRICE_MODES,
  PROJECT_STAGES,
  PROPOSAL_COST_CATEGORIES,
  PROPOSAL_ITEM_KINDS,
  PROPOSAL_MODALITIES,
  PROPOSAL_STATUSES,
  REMINDER_DELIVERY_STATUSES,
  SERVICE_INTERESTS,
  TASK_PRIORITIES,
  TESTIMONIAL_KINDS,
  USER_ROLES,
} from "@/lib/domain";
import type { AgendaReminderChannel } from "@/lib/domain";
import type { Recurrence } from "@/lib/agenda/recurrence";
import type { PermissionOverrides } from "@/lib/permissions/matrix";

// ------------------------------------------------------------------ helpers
const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date());
const bool = (name: string, def = false) => integer(name, { mode: "boolean" }).notNull().default(def);
const sortOrder = () => integer("sort_order").notNull().default(0);

// tipos das colunas JSON
export type LabeledDate = { label: string; date: string };
export type LabeledLink = { label: string; url: string };
export type ChecklistItem = { id: string; text: string; done: boolean };
export type Deliverable = { label: string; quantity: string };
/** Lembrete de um compromisso: antecedência em minutos + canal. Quem envia: `src/server/notifications/reminders.ts`. */
export type AgendaReminder = { minutes: number; channel: AgendaReminderChannel };
/** Planejamento de gravação (só em categorias de produção). */
export type AgendaProductionPlan = {
  address: string;
  /** Horário de chegada da equipe (`HH:mm`). */
  crewArrival: string | null;
  script: string;
  references: string;
  equipment: string;
  /** Quantidade de conteúdos previstos. */
  contentCount: number | null;
  /** Tempo estimado de gravação, em minutos. */
  estimatedMinutes: number | null;
  editDeadline: string | null;
  deliveryDate: string | null;
  prepChecklist: ChecklistItem[];
};
export type MediaVariant = { width: number; height: number; key: string };
export type LeadDetails = {
  /** Campos extras do formulário de evento/casamento. */
  eventType?: string;
  eventLocation?: string;
  guests?: string;
  startTime?: string;
  endTime?: string;
  coverage?: string; // foto, vídeo, foto + vídeo
  storymaker?: string; // sim / não / talvez
  /** Plano, serviço avulso ou serviço de origem, quando o visitante veio de um botão do site. */
  packageName?: string;
  // ---- captação comercial (briefing v2, seção 10)
  company?: string;
  objective?: string;
  /** Marketing: segmento do negócio e perfil (Instagram ou site). */
  segment?: string;
  profile?: string;
  /** Audiovisual: tipo de produção e previsão de quando acontece. */
  productionType?: string;
  timeframe?: string;
  /** Evento: serviços desejados (lista escolhida no formulário de Eventos e Casamentos). */
  services?: string;
  extras?: Record<string, string>;
};

/** Benefício de um serviço (página do serviço). */
export type ServiceBenefit = { title: string; text: string };
/** Pergunta frequente de um serviço (página do serviço). Só aparece com pergunta E resposta. */
export type ServiceFaq = { question: string; answer: string };
/** Par "antes e depois" de um projeto do portfólio (ids de `media`). */
export type PortfolioBeforeAfter = { beforeMediaId: number; afterMediaId: number; caption: string };

// ============================================================== AUTENTICAÇÃO
export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(), // sempre minúsculo
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: USER_ROLES }).notNull().default("admin"),
  active: bool("active", true),
  /** Força a troca de senha no próximo login (contas criadas por outra pessoa). */
  mustChangePassword: bool("must_change_password", false),
  /**
   * Ajustes individuais sobre a matriz do perfil: `{ grant: ["financeiro:ver"], deny: ["leads:excluir"] }`.
   * Validado por zod ao gravar (`setUserPermissions`) e lido com tolerância (`parseOverrides`). Regras em
   * `src/lib/permissions/matrix.ts`.
   */
  permissions: text("permissions", { mode: "json" }).$type<PermissionOverrides>().notNull().default({ grant: [], deny: [] }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 (hex) do token que fica no cookie. O token em si nunca é gravado. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    /** SHA-256 (hex) do token enviado por e-mail. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("password_reset_user_idx").on(t.userId)],
);

/**
 * Convites: a ÚNICA forma de uma conta nascer fora do painel de usuários (não existe cadastro público).
 * Como nos links de redefinição de senha, o banco guarda só o SHA-256 do token; o token vai no link do e-mail.
 * Estados: pendente (nem aceito, nem revogado, dentro da validade) → aceito | revogado | expirado.
 */
export const userInvites = sqliteTable(
  "user_invites",
  {
    id: id(),
    email: text("email").notNull(), // sempre minúsculo
    /** Nome sugerido por quem convidou (a pessoa pode corrigir ao aceitar). */
    name: text("name").notNull().default(""),
    role: text("role", { enum: USER_ROLES }).notNull(),
    /** Convite de perfil `cliente`: a ficha de cliente a que a conta ficará vinculada. */
    clientId: integer("client_id").references((): AnySQLiteColumn => clients.id, { onDelete: "cascade" }),
    /** Convite de funcionário/freelancer: projeto em que a pessoa já entra como membro. */
    projectId: integer("project_id").references((): AnySQLiteColumn => projects.id, { onDelete: "cascade" }),
    /** Papel no projeto (texto livre: "Fotógrafo", "Editor"…), quando há `projectId`. */
    projectRole: text("project_role").notNull().default(""),
    /** SHA-256 (hex) do token do link. O token em si nunca é gravado. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    invitedBy: integer("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    /** Conta criada pelo aceite. */
    acceptedUserId: integer("accepted_user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    revokedBy: integer("revoked_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("user_invites_email_idx").on(t.email)],
);

/** Limitador de tentativas (login, recuperação de senha, formulário público). */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), // ex.: "login:ip:<hash>", "login:email:<hash>", "lead:ip:<hash>"
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start", { mode: "timestamp_ms" }).notNull(),
  blockedUntil: integer("blocked_until", { mode: "timestamp_ms" }),
});

/** Trilha de alterações e acessos do painel. */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"), // nome no momento da ação (sobrevive à exclusão do usuário)
    action: text("action").notNull(), // "login", "create", "update", "delete", "status", "export", "pdf"…
    entity: text("entity"), // "client", "proposal", "site_content"…
    entityId: text("entity_id"),
    summary: text("summary"), // frase curta em pt-BR. Nunca gravar senhas/tokens aqui.
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_entity_idx").on(t.entity, t.entityId)],
);

// ===================================================================== MÍDIA
export const media = sqliteTable(
  "media",
  {
    id: id(),
    /** Caminho dentro do storage (aleatório, não adivinhável). Ex.: "2026/11/ab12cd34ef.webp". */
    storageKey: text("storage_key").notNull().unique(),
    visibility: text("visibility", { enum: MEDIA_VISIBILITIES }).notNull().default("public"),
    mime: text("mime").notNull(),
    originalName: text("original_name").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** Texto alternativo (acessibilidade/SEO) — obrigatório para imagens públicas com conteúdo. */
    alt: text("alt").notNull().default(""),
    /** Versões redimensionadas (WebP) geradas no upload. */
    variants: text("variants", { mode: "json" }).$type<MediaVariant[]>().notNull().default([]),
    /** Cor dominante/placeholder (hex) para evitar "pulo" de layout. */
    placeholderColor: text("placeholder_color"),
    uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("media_visibility_idx").on(t.visibility)],
);

// ============================================================ SITE PÚBLICO
/** Blocos de conteúdo editável do site (um registro por seção; valor em JSON validado por zod). */
export const siteContent = sqliteTable("site_content", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Configurações internas do painel (reserva de caixa, padrões de proposta…). Nunca públicas. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Barra de avisos no topo do site. */
export const announcements = sqliteTable("announcements", {
  id: id(),
  message: text("message").notNull(),
  linkLabel: text("link_label"),
  linkUrl: text("link_url"),
  bgColor: text("bg_color", { enum: BRAND_COLORS }).notNull().default("roxo"),
  textColor: text("text_color", { enum: BRAND_COLORS }).notNull().default("branco"),
  /** Janela de exibição, horário local `YYYY-MM-DDTHH:mm`. Nulo = sem limite. */
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  enabled: bool("enabled", false),
  dismissible: bool("dismissible", true),
  /** Páginas em que o aviso aparece (chaves de `src/lib/site/paths.ts`). Vazio = todas. */
  pages: text("pages", { mode: "json" }).$type<string[]>().notNull().default([]),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Banners do carrossel da página inicial (briefing v2, seção 04). Só aparecem os ativos e dentro da janela
 * de exibição. Sem nenhum banner no ar, a home mostra a abertura padrão (`HomeHero`).
 */
export const banners = sqliteTable("banners", {
  id: id(),
  /** Nome interno, só para a lista do painel. */
  name: text("name").notNull().default(""),
  layout: text("layout", { enum: BANNER_LAYOUTS }).notNull().default("tipografico"),
  title: text("title").notNull().default(""),
  subtitle: text("subtitle").notNull().default(""),
  buttonLabel: text("button_label").notNull().default(""),
  buttonUrl: text("button_url").notNull().default(""),
  secondaryLabel: text("secondary_label").notNull().default(""),
  secondaryUrl: text("secondary_url").notNull().default(""),
  /** Imagem da versão desktop (sugestão: 1920 × 800). Em banner com vídeo, serve de capa. */
  desktopMediaId: integer("desktop_media_id").references(() => media.id, { onDelete: "set null" }),
  /** Imagem da versão celular (sugestão: 1080 × 1350). Sem ela, usa a de desktop. */
  mobileMediaId: integer("mobile_media_id").references(() => media.id, { onDelete: "set null" }),
  /** Vídeo curto de fundo (sem áudio, em loop). Opcional. */
  videoMediaId: integer("video_media_id").references(() => media.id, { onDelete: "set null" }),
  /** Descrição da imagem para leitores de tela — obrigatória em peça pronta. */
  alt: text("alt").notNull().default(""),
  /** Fundo do banner só de texto. */
  bgColor: text("bg_color", { enum: BRAND_COLORS }).notNull().default("roxo"),
  /** Cor do texto sobre a mídia. */
  tone: text("tone", { enum: BANNER_TONES }).notNull().default("claro"),
  /** Tempo em tela antes de passar para o próximo, em segundos. */
  durationSeconds: integer("duration_seconds").notNull().default(7),
  /** Janela de exibição, horário local `YYYY-MM-DDTHH:mm`. Nulo = sem limite. */
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  enabled: bool("enabled", false),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = sqliteTable("services", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** Frase curta para cards. */
  summary: text("summary").notNull().default(""),
  /** Texto longo (markdown leve). */
  description: text("description").notNull().default(""),
  /** Lista de entregas/itens do serviço. */
  items: text("items", { mode: "json" }).$type<string[]>().notNull().default([]),
  ctaLabel: text("cta_label").notNull().default("Solicitar orçamento"),
  /** Valor pré-selecionado no formulário de contato (SERVICE_INTERESTS). */
  interest: text("interest", { enum: SERVICE_INTERESTS }).notNull().default("outro"),
  coverMediaId: integer("cover_media_id").references(() => media.id, { onDelete: "set null" }),
  gallery: text("gallery", { mode: "json" }).$type<number[]>().notNull().default([]), // ids de media
  videoUrl: text("video_url"),
  /** Página temática além da página do serviço (ex.: /eventos-e-casamentos): vira um segundo botão. */
  pagePath: text("page_path"),
  /** Benefícios (página do serviço). Vazio = o bloco não aparece. */
  benefits: text("benefits", { mode: "json" }).$type<ServiceBenefit[]>().notNull().default([]),
  /** Perguntas frequentes do serviço. Vazio = o bloco não aparece. */
  faq: text("faq", { mode: "json" }).$type<ServiceFaq[]>().notNull().default([]),
  /** Projetos do portfólio relacionados (ids). Só aparecem os publicados. */
  relatedProjectIds: text("related_project_ids", { mode: "json" }).$type<number[]>().notNull().default([]),
  visible: bool("visible", true),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const packages = sqliteTable("packages", {
  id: id(),
  kind: text("kind", { enum: PACKAGE_KINDS }).notNull().default("plano"),
  name: text("name").notNull(),
  /** "Para marcas que…" */
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  /** Serviços incluídos. */
  includes: text("includes", { mode: "json" }).$type<string[]>().notNull().default([]),
  /** Quantidades de entregas (ex.: {label: "Reels", quantity: "8 por mês"}). Vazio = não exibe. */
  deliverables: text("deliverables", { mode: "json" }).$type<Deliverable[]>().notNull().default([]),
  recordingDuration: text("recording_duration").notNull().default(""),
  revisionLimit: text("revision_limit").notNull().default(""),
  priceMode: text("price_mode", { enum: PRICE_MODES }).notNull().default("sob_consulta"),
  priceCents: integer("price_cents"),
  /** Complemento do preço (ex.: "/mês", "por diária"). */
  priceSuffix: text("price_suffix").notNull().default(""),
  recommended: bool("recommended", false),
  /** Plano em que este se apoia ("tudo do plano X, mais…"). Vale no cartão e na tabela comparativa. */
  basePackageId: integer("base_package_id"),
  /** Opcionais que podem ser acrescentados ao plano. Vazio = não exibe. */
  optionals: text("optionals", { mode: "json" }).$type<string[]>().notNull().default([]),
  /** Condição de desconto (ex.: "10% no contrato semestral"). Só aparece junto de um valor publicado. */
  discountNote: text("discount_note").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default("Solicitar orçamento"),
  visible: bool("visible", true),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const portfolioProjects = sqliteTable(
  "portfolio_projects",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    clientName: text("client_name").notNull().default(""),
    /** Só exibe o nome do cliente quando autorizado. */
    showClient: bool("show_client", false),
    category: text("category", { enum: PORTFOLIO_CATEGORIES }).notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    servicesDone: text("services_done", { mode: "json" }).$type<string[]>().notNull().default([]),
    coverMediaId: integer("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    gallery: text("gallery", { mode: "json" }).$type<number[]>().notNull().default([]),
    videoUrl: text("video_url"),
    /** Vídeos adicionais (links do YouTube/Vimeo). */
    extraVideoUrls: text("extra_video_urls", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Estudo de caso (briefing v2, seção 08). Cada bloco só aparece quando preenchido. */
    objective: text("objective").notNull().default(""),
    challenge: text("challenge").notNull().default(""),
    solution: text("solution").notNull().default(""),
    /** Resultados comprovados — só o que os sócios puderem demonstrar. */
    results: text("results").notNull().default(""),
    /** Pares "antes e depois". */
    beforeAfter: text("before_after", { mode: "json" }).$type<PortfolioBeforeAfter[]>().notNull().default([]),
    /** Fotos de bastidores (ids de media). */
    backstage: text("backstage", { mode: "json" }).$type<number[]>().notNull().default([]),
    /** Projetos relacionados escolhidos à mão (ids). Só aparecem os publicados. */
    relatedProjectIds: text("related_project_ids", { mode: "json" }).$type<number[]>().notNull().default([]),
    /** Trabalho da NÓS ou experiência anterior de um fundador (o site identifica a diferença). */
    origin: text("origin", { enum: PORTFOLIO_ORIGINS }).notNull().default("nos"),
    /** Complemento da origem (ex.: "Trabalho de Pedro Henrique antes da NÓS"). */
    originNote: text("origin_note").notNull().default(""),
    /** Data do trabalho/publicação exibida no site. */
    projectDate: text("project_date"),
    published: bool("published", false),
    featured: bool("featured", false),
    sortOrder: sortOrder(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("portfolio_published_idx").on(t.published, t.category)],
);

export const testimonials = sqliteTable("testimonials", {
  id: id(),
  kind: text("kind", { enum: TESTIMONIAL_KINDS }).notNull().default("texto"),
  authorName: text("author_name").notNull().default(""),
  authorRole: text("author_role").notNull().default(""), // empresa / relação com a NÓS
  content: text("content").notNull().default(""),
  mediaId: integer("media_id").references(() => media.id, { onDelete: "set null" }), // foto do cliente ou print
  /** Descrição acessível do print (o que a conversa diz). */
  mediaAlt: text("media_alt").notNull().default(""),
  videoUrl: text("video_url"),
  /** O cliente autorizou a publicação (nome, imagem, conteúdo)? Sem isso não publica. */
  authorized: bool("authorized", false),
  published: bool("published", false),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const faqs = sqliteTable("faqs", {
  id: id(),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  /** Só aparece no site quando publicada (respostas precisam ser revisadas pelos sócios). */
  published: bool("published", false),
  /** Aparece também no resumo de FAQ da home. */
  showOnHome: bool("show_on_home", false),
  /** Aparece na página de casamentos. */
  showOnWeddings: bool("show_on_weddings", false),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ======================================================================= CRM
export const leads = sqliteTable(
  "leads",
  {
    id: id(),
    name: text("name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    email: text("email"),
    serviceInterest: text("service_interest", { enum: SERVICE_INTERESTS }).notNull().default("outro"),
    eventDate: text("event_date"),
    city: text("city"),
    message: text("message").notNull().default(""),
    details: text("details", { mode: "json" }).$type<LeadDetails>().notNull().default({}),
    source: text("source", { enum: CONTACT_SOURCES }).notNull().default("site"),
    /** Página do site de onde o formulário foi enviado. */
    originPath: text("origin_path"),
    /** LGPD: momento e versão da política aceita. */
    consentAt: integer("consent_at", { mode: "timestamp_ms" }),
    consentVersion: text("consent_version"),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("novo"),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("leads_status_idx").on(t.status, t.createdAt)],
);

export const clients = sqliteTable(
  "clients",
  {
    id: id(),
    /** Nome ou empresa. */
    name: text("name").notNull(),
    contactName: text("contact_name").notNull().default(""),
    kind: text("kind", { enum: CLIENT_KINDS }).notNull().default("pf"),
    whatsapp: text("whatsapp").notNull().default(""),
    email: text("email").notNull().default(""),
    document: text("document").notNull().default(""), // CPF/CNPJ (opcional)
    city: text("city").notNull().default(""),
    segment: text("segment").notNull().default(""),
    source: text("source", { enum: CONTACT_SOURCES }).notNull().default("outro"),
    serviceInterest: text("service_interest", { enum: SERVICE_INTERESTS }).notNull().default("outro"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }), // responsável
    status: text("status", { enum: CLIENT_STATUSES }).notNull().default("novo_contato"),
    lostReason: text("lost_reason").notNull().default(""),
    firstContactAt: text("first_contact_at"), // YYYY-MM-DD
    nextStep: text("next_step").notNull().default(""),
    nextStepDate: text("next_step_date"),
    importantDates: text("important_dates", { mode: "json" }).$type<LabeledDate[]>().notNull().default([]),
    notes: text("notes").notNull().default(""), // observações internas
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("clients_status_idx").on(t.status), index("clients_name_idx").on(t.name)],
);

/** Histórico de atendimento (inclui mudanças de status, com data e autor). */
export const clientInteractions = sqliteTable(
  "client_interactions",
  {
    id: id(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind", { enum: INTERACTION_KINDS }).notNull().default("nota"),
    content: text("content").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    createdAt: createdAt(),
  },
  (t) => [index("interactions_client_idx").on(t.clientId, t.occurredAt)],
);

// ================================================== PROJETOS, TAREFAS, AGENDA
export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    proposalId: integer("proposal_id"), // proposta de origem (sem FK para evitar ciclo)
    title: text("title").notNull(),
    serviceType: text("service_type", { enum: SERVICE_INTERESTS }).notNull().default("outro"),
    stage: text("stage", { enum: PROJECT_STAGES }).notNull().default("briefing"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    location: text("location").notNull().default(""),
    eventDate: text("event_date"), // data do evento/gravação principal
    shootDeadline: text("shoot_deadline"), // prazo de gravação
    deliveryDeadline: text("delivery_deadline"), // prazo de entrega
    deliveredAt: text("delivered_at"), // data em que a entrega foi feita
    checklist: text("checklist", { mode: "json" }).$type<ChecklistItem[]>().notNull().default([]),
    // Arquivos e entregas: links (não hospedamos vídeo pesado)
    driveUrl: text("drive_url").notNull().default(""),
    galleryUrl: text("gallery_url").notNull().default(""),
    referencesUrl: text("references_url").notNull().default(""),
    finalFilesUrl: text("final_files_url").notNull().default(""),
    links: text("links", { mode: "json" }).$type<LabeledLink[]>().notNull().default([]),
    backupStatus: text("backup_status", { enum: BACKUP_STATUSES }).notNull().default("pendente"),
    backupNote: text("backup_note").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("projects_stage_idx").on(t.stage), index("projects_client_idx").on(t.clientId)],
);

/**
 * Membros de um projeto: quem (funcionário, freelancer…) enxerga o projeto e o que pode fazer NELE.
 * Perfis com visão geral (admin, sócio, gestor, técnico) não precisam estar aqui. Tirar a linha revoga o acesso.
 */
export const projectMembers = sqliteTable(
  "project_members",
  {
    id: id(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Papel NESTE projeto — texto livre (sugestões em TEAM_FUNCTIONS): "Fotógrafo", "Editor"… */
    role: text("role").notNull().default(""),
    canView: bool("can_view", true),
    canEdit: bool("can_edit", false),
    canDownload: bool("can_download", false),
    /** Enviar arquivos para o projeto. */
    canUpload: bool("can_upload", false),
    addedBy: integer("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("project_members_project_user_idx").on(t.projectId, t.userId), index("project_members_user_idx").on(t.userId)],
);

/**
 * "Usuários vinculados" à ficha de um cliente: contas de perfil `cliente` que acompanham os projetos dele na
 * Área do Cliente (N:N — a agência do cliente pode ter duas pessoas; uma pessoa pode responder por duas empresas).
 */
export const clientUsers = sqliteTable(
  "client_users",
  {
    id: id(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedBy: integer("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("client_users_client_user_idx").on(t.clientId, t.userId), index("client_users_user_idx").on(t.userId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    dueDate: text("due_date"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    priority: text("priority", { enum: TASK_PRIORITIES }).notNull().default("normal"),
    done: bool("done", false),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tasks_due_idx").on(t.done, t.dueDate)],
);

/** Categorias da agenda (personalizáveis): dão cor e ícone ao compromisso e ligam comportamentos. */
export const agendaCategories = sqliteTable("agenda_categories", {
  id: id(),
  /** Chave estável das categorias iniciais (`AGENDA_DEFAULT_CATEGORIES`); nula nas criadas pelo cliente. */
  slug: text("slug").unique(),
  name: text("name").notNull(),
  color: text("color", { enum: AGENDA_COLORS }).notNull().default("roxo"),
  icon: text("icon", { enum: AGENDA_ICONS }).notNull().default("calendar"),
  /** Dia inteiro desta categoria ocupa a pessoa (férias, indisponibilidade): entra na conta de conflitos. */
  blocksDay: bool("blocks_day", false),
  /** Mostra o bloco "Planejamento de gravação" no compromisso. */
  isProduction: bool("is_production", false),
  active: bool("active", true),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Agendas (calendários). As de tipo `financeira` e `editorial` são camadas DERIVADAS de outros módulos: existem
 * aqui só para ter nome, cor e ordem — nenhum compromisso é gravado nelas.
 */
export const agendaCalendars = sqliteTable(
  "agenda_calendars",
  {
    id: id(),
    slug: text("slug").unique(),
    name: text("name").notNull(),
    kind: text("kind", { enum: AGENDA_CALENDAR_KINDS }).notNull().default("geral"),
    /** Dono, nas agendas pessoais (uma por usuário do painel). */
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    color: text("color", { enum: AGENDA_COLORS }).notNull().default("roxo"),
    active: bool("active", true),
    sortOrder: sortOrder(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("agenda_calendars_user_idx").on(t.userId)],
);

export const agendaEvents = sqliteTable(
  "agenda_events",
  {
    id: id(),
    title: text("title").notNull(),
    /** LEGADO: resumo grosso da categoria para as telas antigas. A agenda usa `categoryId`. */
    kind: text("kind", { enum: AGENDA_KINDS }).notNull().default("outro"),
    categoryId: integer("category_id").references(() => agendaCategories.id, { onDelete: "set null" }),
    calendarId: integer("calendar_id").references(() => agendaCalendars.id, { onDelete: "set null" }),
    description: text("description").notNull().default(""),
    date: text("date").notNull(), // YYYY-MM-DD (em séries: a primeira ocorrência)
    /** Último dia, em compromissos de vários dias. Nulo = termina no mesmo dia. */
    endDate: text("end_date"),
    startTime: text("start_time"), // HH:mm — nulo = dia inteiro
    endTime: text("end_time"),
    location: text("location").notNull().default(""),
    mapUrl: text("map_url").notNull().default(""),
    meetingUrl: text("meeting_url").notNull().default(""),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    /** LEGADO: o primeiro responsável (as pessoas ficam em `agenda_event_people`). */
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    priority: text("priority", { enum: AGENDA_PRIORITIES }).notNull().default("normal"),
    status: text("status", { enum: AGENDA_STATUSES }).notNull().default("confirmado"),
    /** `particular`: quem não participa só vê "Ocupado" no horário (ver src/server/agenda/privacy.ts). */
    visibility: text("visibility", { enum: AGENDA_VISIBILITIES }).notNull().default("normal"),
    checklist: text("checklist", { mode: "json" }).$type<ChecklistItem[]>().notNull().default([]),
    /** Observações internas. */
    notes: text("notes").notNull().default(""),
    /** A configuração dos lembretes; as entregas ficam em `agenda_reminder_deliveries`. */
    reminders: text("reminders", { mode: "json" }).$type<AgendaReminder[]>().notNull().default([]),
    /** Regra de repetição (`src/lib/agenda/recurrence.ts`). Nulo = não se repete. */
    recurrence: text("recurrence", { mode: "json" }).$type<Recurrence | null>(),
    /** Dias da série que não acontecem (excluídos ou editados sozinhos). */
    recurrenceExceptions: text("recurrence_exceptions", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Ocorrência editada sozinha ("só este"): a série de origem e o dia que ela substitui. */
    seriesId: integer("series_id").references((): AnySQLiteColumn => agendaEvents.id, { onDelete: "cascade" }),
    originalDate: text("original_date"),
    /** Anexos: ids de `media` (privados, pelo pipeline de upload). */
    attachments: text("attachments", { mode: "json" }).$type<number[]>().notNull().default([]),
    /** Planejamento de gravação (categorias com `isProduction`). */
    production: text("production", { mode: "json" }).$type<AgendaProductionPlan | null>(),
    /** Quem criou — o "dono" de um compromisso particular. */
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("agenda_date_idx").on(t.date),
    index("agenda_series_idx").on(t.seriesId),
    index("agenda_calendar_idx").on(t.calendarId),
    index("agenda_category_idx").on(t.categoryId),
  ],
);

/** Pessoas de um compromisso: responsáveis e participantes (usuários) e participantes externos (só o nome). */
export const agendaEventPeople = sqliteTable(
  "agenda_event_people",
  {
    id: id(),
    eventId: integer("event_id")
      .notNull()
      .references(() => agendaEvents.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: AGENDA_PERSON_ROLES }).notNull().default("participante"),
    /** Nome do participante externo (quando `userId` é nulo). */
    externalName: text("external_name").notNull().default(""),
    sortOrder: sortOrder(),
  },
  (t) => [uniqueIndex("agenda_people_event_user_idx").on(t.eventId, t.userId), index("agenda_people_user_idx").on(t.userId)],
);

/** Modelos de checklist reutilizáveis (por tipo de produção, quando ligados a uma categoria). */
export const agendaChecklistTemplates = sqliteTable("agenda_checklist_templates", {
  id: id(),
  name: text("name").notNull(),
  /** Categoria sugerida (nulo = serve para qualquer compromisso). */
  categoryId: integer("category_id").references(() => agendaCategories.id, { onDelete: "set null" }),
  items: text("items", { mode: "json" }).$type<string[]>().notNull().default([]),
  active: bool("active", true),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ============================================================== NOTIFICAÇÕES
/**
 * Central de notificações do painel (briefing v2, seção 30): um aviso por pessoa. Cada pessoa só lê as suas
 * (`src/server/notifications`). O `href` é sempre um caminho interno (`/painel/…`).
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull().default(""),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt), index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

/**
 * Controle de entrega dos lembretes da agenda: uma linha por compromisso + início da ocorrência + antecedência +
 * canal + pessoa. O índice único é a garantia de que o mesmo lembrete nunca sai duas vezes (o despachante só
 * envia depois de conseguir inserir a linha). `occurrenceStart` é o início local (`YYYY-MM-DDTHH:mm`): mudar o
 * horário do compromisso rearma os lembretes.
 */
export const agendaReminderDeliveries = sqliteTable(
  "agenda_reminder_deliveries",
  {
    id: id(),
    eventId: integer("event_id")
      .notNull()
      .references(() => agendaEvents.id, { onDelete: "cascade" }),
    occurrenceStart: text("occurrence_start").notNull(),
    minutes: integer("minutes").notNull(),
    channel: text("channel", { enum: AGENDA_REMINDER_CHANNELS }).notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: REMINDER_DELIVERY_STATUSES }).notNull().default("enviado"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("agenda_reminder_delivery_idx").on(t.eventId, t.occurrenceStart, t.minutes, t.channel, t.userId),
    index("agenda_reminder_start_idx").on(t.occurrenceStart),
  ],
);

// ================================================================= PROPOSTAS
export const proposals = sqliteTable(
  "proposals",
  {
    id: id(),
    /** Número exibido ao cliente, ex.: "2026-007". Único por versão (número + versão). */
    number: text("number").notNull(),
    version: integer("version").notNull().default(1),
    /** Proposta original desta cadeia de versões (nulo na primeira). */
    rootId: integer("root_id"),
    /** Modelos reutilizáveis ficam na mesma tabela. */
    isTemplate: bool("is_template", false),
    templateName: text("template_name").notNull().default(""),
    modality: text("modality", { enum: PROPOSAL_MODALITIES }).notNull().default("personalizada"),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("rascunho"),

    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    /** Nome como aparece na capa do PDF (pode diferir do cadastro, ex.: "Ana & Bruno"). */
    clientDisplayName: text("client_display_name").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }), // responsável comercial

    title: text("title").notNull(), // ex.: "Cobertura de casamento"
    eventDate: text("event_date"),
    eventLocation: text("event_location").notNull().default(""),
    validUntil: text("valid_until"),

    // ---- textos que VÃO para o PDF
    intro: text("intro").notNull().default(""), // descrição do projeto
    scheduleText: text("schedule_text").notNull().default(""), // cronograma / duração da cobertura
    exclusions: text("exclusions").notNull().default(""), // o que não está incluso
    paymentNotes: text("payment_notes").notNull().default(""), // condições de pagamento (texto livre)
    conditions: text("conditions").notNull().default(""), // observações e condições comerciais

    // ---- preço ao cliente
    /** Desconto concedido. Só entra no PDF quando `discountApproved` for verdadeiro. */
    discountCents: integer("discount_cents").notNull().default(0),
    discountLabel: text("discount_label").notNull().default(""),
    discountApproved: bool("discount_approved", false),
    /** Mostrar o valor de cada item no PDF (senão, só o total). */
    showItemPrices: bool("show_item_prices", false),
    entryMode: text("entry_mode", { enum: ENTRY_MODES }).notNull().default("percentual"),
    entryPercent: real("entry_percent").notNull().default(0),
    entryCents: integer("entry_cents").notNull().default(0),

    // ---- cálculo INTERNO (nunca vai para o PDF)
    internalNotes: text("internal_notes").notNull().default(""),
    /** Rateio de despesas fixas atribuído a esta proposta. */
    overheadCents: integer("overhead_cents").notNull().default(0),
    /** Percentual estimado de tributos sobre o preço. */
    taxPercent: real("tax_percent").notNull().default(0),
    /** Margem-alvo (%), para comparar com a margem calculada. */
    targetMarginPercent: real("target_margin_percent").notNull().default(0),

    // ---- controle
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }), // projeto gerado
    contractId: integer("contract_id"), // contrato anexado (sem FK para evitar ciclo)
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("proposals_number_version_idx").on(t.number, t.version),
    index("proposals_status_idx").on(t.isTemplate, t.status),
    index("proposals_client_idx").on(t.clientId),
  ],
);

/** Itens e entregas apresentados ao cliente. */
export const proposalItems = sqliteTable(
  "proposal_items",
  {
    id: id(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PROPOSAL_ITEM_KINDS }).notNull().default("incluso"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    quantity: real("quantity").notNull().default(1),
    unit: text("unit").notNull().default(""), // "horas", "fotógrafos", "vídeos"…
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    sortOrder: sortOrder(),
  },
  (t) => [index("proposal_items_proposal_idx").on(t.proposalId, t.sortOrder)],
);

/** Custos internos da proposta — SOMENTE painel. Jamais renderizar em PDF ou página pública. */
export const proposalCosts = sqliteTable(
  "proposal_costs",
  {
    id: id(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    category: text("category", { enum: PROPOSAL_COST_CATEGORIES }).notNull().default("outros"),
    description: text("description").notNull().default(""),
    amountCents: integer("amount_cents").notNull().default(0),
    sortOrder: sortOrder(),
  },
  (t) => [index("proposal_costs_proposal_idx").on(t.proposalId, t.sortOrder)],
);

/** Parcelas e vencimentos (entrada + saldo). */
export const proposalPayments = sqliteTable(
  "proposal_payments",
  {
    id: id(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "Entrada (30%)", "Parcela 1 de 3"…
    dueDate: text("due_date"), // YYYY-MM-DD
    dueLabel: text("due_label").notNull().default(""), // alternativa textual: "na assinatura do contrato"
    amountCents: integer("amount_cents").notNull().default(0),
    sortOrder: sortOrder(),
  },
  (t) => [index("proposal_payments_proposal_idx").on(t.proposalId, t.sortOrder)],
);

// ================================================================= CONTRATOS
export const contracts = sqliteTable(
  "contracts",
  {
    id: id(),
    title: text("title").notNull(),
    kind: text("kind", { enum: CONTRACT_KINDS }).notNull().default("outro"),
    /** Modelos de contrato (texto reutilizável) ficam na mesma tabela. */
    isTemplate: bool("is_template", false),
    /** Texto do contrato/modelo (markdown leve). A redação jurídica depende de revisão. */
    body: text("body").notNull().default(""),
    versionLabel: text("version_label").notNull().default(""),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    proposalId: integer("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    status: text("status", { enum: CONTRACT_STATUSES }).notNull().default("rascunho"),
    signedAt: text("signed_at"), // YYYY-MM-DD
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
    /** Documento assinado (upload privado) ou link externo. */
    fileMediaId: integer("file_media_id").references(() => media.id, { onDelete: "set null" }),
    externalUrl: text("external_url").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contracts_client_idx").on(t.clientId), index("contracts_template_idx").on(t.isTemplate)],
);

// ================================================================ FINANCEIRO
/** Lançamentos. `paidAt` nulo = previsto; preenchido = realizado (recebido/pago). */
export const financeEntries = sqliteTable(
  "finance_entries",
  {
    id: id(),
    type: text("type", { enum: FINANCE_TYPES }).notNull(),
    category: text("category", { enum: FINANCE_CATEGORIES }).notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: text("due_date").notNull(), // vencimento / data prevista
    paidAt: text("paid_at"), // data em que foi efetivamente recebido/pago
    installmentLabel: text("installment_label").notNull().default(""), // "Entrada", "2/3"…
    method: text("method", { enum: PAYMENT_METHODS }),
    supplier: text("supplier").notNull().default(""), // fornecedor / freelancer (despesas)
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    proposalId: integer("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    /** Comprovante: upload privado ou link. */
    receiptMediaId: integer("receipt_media_id").references(() => media.id, { onDelete: "set null" }),
    receiptUrl: text("receipt_url").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("finance_due_idx").on(t.dueDate), index("finance_type_idx").on(t.type, t.paidAt)],
);

// ===================================================== CALENDÁRIO EDITORIAL
export const contentItems = sqliteTable(
  "content_items",
  {
    id: id(),
    title: text("title").notNull(), // tema
    /** Nulo = conteúdo da própria NÓS; preenchido = conteúdo de um cliente. */
    clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
    network: text("network", { enum: CONTENT_NETWORKS }).notNull().default("instagram"),
    format: text("format", { enum: CONTENT_FORMATS }).notNull().default("reels"),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("ideia"),
    ideaNotes: text("idea_notes").notNull().default(""),
    script: text("script").notNull().default(""), // roteiro
    caption: text("caption").notNull().default(""), // legenda
    cta: text("cta").notNull().default(""),
    recordDate: text("record_date"), // data de gravação
    editDeadline: text("edit_deadline"), // prazo de edição
    publishDate: text("publish_date"), // data de publicação
    approvalStatus: text("approval_status", { enum: APPROVAL_STATUSES }).notNull().default("pendente"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    assetUrl: text("asset_url").notNull().default(""), // link Canva / Drive / CapCut
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("content_status_idx").on(t.status), index("content_publish_idx").on(t.publishDate)],
);

// ===================================================== BIBLIOTECA DA MARCA
export const brandAssets = sqliteTable("brand_assets", {
  id: id(),
  category: text("category", { enum: BRAND_ASSET_CATEGORIES }).notNull().default("outro"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  /** Link (Drive, Canva…) ou arquivo enviado (privado). */
  url: text("url").notNull().default(""),
  mediaId: integer("media_id").references(() => media.id, { onDelete: "set null" }),
  sortOrder: sortOrder(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ================================================================== RELAÇÕES
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projectMemberships: many(projectMembers),
  clientLinks: many(clientUsers),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const clientUsersRelations = relations(clientUsers, ({ one }) => ({
  client: one(clients, { fields: [clientUsers.clientId], references: [clients.id] }),
  user: one(users, { fields: [clientUsers.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  cover: one(media, { fields: [services.coverMediaId], references: [media.id] }),
}));

export const portfolioProjectsRelations = relations(portfolioProjects, ({ one }) => ({
  cover: one(media, { fields: [portfolioProjects.coverMediaId], references: [media.id] }),
}));

export const testimonialsRelations = relations(testimonials, ({ one }) => ({
  media: one(media, { fields: [testimonials.mediaId], references: [media.id] }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  client: one(clients, { fields: [leads.clientId], references: [clients.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  owner: one(users, { fields: [clients.ownerId], references: [users.id] }),
  interactions: many(clientInteractions),
  projects: many(projects),
  proposals: many(proposals),
  contracts: many(contracts),
  leads: many(leads),
  tasks: many(tasks),
  agendaEvents: many(agendaEvents),
  financeEntries: many(financeEntries),
  contentItems: many(contentItems),
  linkedUsers: many(clientUsers),
}));

export const clientInteractionsRelations = relations(clientInteractions, ({ one }) => ({
  client: one(clients, { fields: [clientInteractions.clientId], references: [clients.id] }),
  user: one(users, { fields: [clientInteractions.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  tasks: many(tasks),
  agendaEvents: many(agendaEvents),
  contracts: many(contracts),
  financeEntries: many(financeEntries),
  members: many(projectMembers),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  owner: one(users, { fields: [tasks.ownerId], references: [users.id] }),
  client: one(clients, { fields: [tasks.clientId], references: [clients.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
}));

export const agendaEventsRelations = relations(agendaEvents, ({ one, many }) => ({
  owner: one(users, { fields: [agendaEvents.ownerId], references: [users.id] }),
  client: one(clients, { fields: [agendaEvents.clientId], references: [clients.id] }),
  project: one(projects, { fields: [agendaEvents.projectId], references: [projects.id] }),
  category: one(agendaCategories, { fields: [agendaEvents.categoryId], references: [agendaCategories.id] }),
  calendar: one(agendaCalendars, { fields: [agendaEvents.calendarId], references: [agendaCalendars.id] }),
  people: many(agendaEventPeople),
}));

export const agendaEventPeopleRelations = relations(agendaEventPeople, ({ one }) => ({
  event: one(agendaEvents, { fields: [agendaEventPeople.eventId], references: [agendaEvents.id] }),
  user: one(users, { fields: [agendaEventPeople.userId], references: [users.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  client: one(clients, { fields: [proposals.clientId], references: [clients.id] }),
  owner: one(users, { fields: [proposals.ownerId], references: [users.id] }),
  project: one(projects, { fields: [proposals.projectId], references: [projects.id] }),
  items: many(proposalItems),
  costs: many(proposalCosts),
  payments: many(proposalPayments),
}));

export const proposalItemsRelations = relations(proposalItems, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalItems.proposalId], references: [proposals.id] }),
}));

export const proposalCostsRelations = relations(proposalCosts, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalCosts.proposalId], references: [proposals.id] }),
}));

export const proposalPaymentsRelations = relations(proposalPayments, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalPayments.proposalId], references: [proposals.id] }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  client: one(clients, { fields: [contracts.clientId], references: [clients.id] }),
  project: one(projects, { fields: [contracts.projectId], references: [projects.id] }),
  proposal: one(proposals, { fields: [contracts.proposalId], references: [proposals.id] }),
  file: one(media, { fields: [contracts.fileMediaId], references: [media.id] }),
}));

export const financeEntriesRelations = relations(financeEntries, ({ one }) => ({
  client: one(clients, { fields: [financeEntries.clientId], references: [clients.id] }),
  project: one(projects, { fields: [financeEntries.projectId], references: [projects.id] }),
  proposal: one(proposals, { fields: [financeEntries.proposalId], references: [proposals.id] }),
  receipt: one(media, { fields: [financeEntries.receiptMediaId], references: [media.id] }),
}));

export const contentItemsRelations = relations(contentItems, ({ one }) => ({
  client: one(clients, { fields: [contentItems.clientId], references: [clients.id] }),
  owner: one(users, { fields: [contentItems.ownerId], references: [users.id] }),
}));

export const brandAssetsRelations = relations(brandAssets, ({ one }) => ({
  media: one(media, { fields: [brandAssets.mediaId], references: [media.id] }),
}));

// ===================================================================== TIPOS
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type UserInvite = typeof userInvites.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type ClientUser = typeof clientUsers.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Package = typeof packages.$inferSelect;
export type PortfolioProject = typeof portfolioProjects.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type ClientInteraction = typeof clientInteractions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type AgendaEvent = typeof agendaEvents.$inferSelect;
export type AgendaCategory = typeof agendaCategories.$inferSelect;
export type AgendaCalendar = typeof agendaCalendars.$inferSelect;
export type AgendaEventPerson = typeof agendaEventPeople.$inferSelect;
export type AgendaChecklistTemplate = typeof agendaChecklistTemplates.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AgendaReminderDelivery = typeof agendaReminderDeliveries.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type ProposalItem = typeof proposalItems.$inferSelect;
export type ProposalCost = typeof proposalCosts.$inferSelect;
export type ProposalPayment = typeof proposalPayments.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type BrandAsset = typeof brandAssets.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
