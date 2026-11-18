/**
 * Conteúdo e calendário editorial no PAINEL: consultas e mutações (só banco; as Server Actions autorizam,
 * validam e auditam). `clientId` nulo = conteúdo da própria NÓS.
 */
import "server-only";
import { and, asc, count, desc, eq, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, contentItems, users, type ContentItem } from "@/db/schema";
import type { ISODate } from "@/lib/dates";
import type { ApprovalStatus, ContentFormat, ContentNetwork, ContentStatus } from "@/lib/domain";
import { buildCalendarEntries, copyTitle, publishDateForStatus, type ContentCalendarEntry } from "./logic";

export const CONTENT_PAGE_SIZE = 20;
/** No quadro, "Publicado" mostra só os mais recentes (a coluna cresceria sem parar). */
export const BOARD_PUBLISHED_LIMIT = 12;

// ------------------------------------------------------------------ consultas
export type ContentFilters = {
  /** "nos" = conteúdo da NÓS (sem cliente) · número = id do cliente. */
  account?: "nos" | number;
  network?: ContentNetwork;
  format?: ContentFormat;
  ownerId?: number;
  status?: ContentStatus;
  /** Só itens sem data de publicação (banco de ideias). */
  undated?: boolean;
  /** Busca no tema, nas anotações, no roteiro e na legenda. */
  q?: string;
};

export type ContentListItem = {
  id: number;
  title: string;
  clientId: number | null;
  clientName: string | null;
  network: ContentNetwork;
  format: ContentFormat;
  status: ContentStatus;
  approvalStatus: ApprovalStatus;
  ownerId: number | null;
  ownerName: string | null;
  publishDate: string | null;
  recordDate: string | null;
  editDeadline: string | null;
};

const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

function contentWhere(filters: ContentFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (filters.account === "nos") conditions.push(isNull(contentItems.clientId));
  else if (typeof filters.account === "number") conditions.push(eq(contentItems.clientId, filters.account));
  if (filters.network) conditions.push(eq(contentItems.network, filters.network));
  if (filters.format) conditions.push(eq(contentItems.format, filters.format));
  if (filters.ownerId) conditions.push(eq(contentItems.ownerId, filters.ownerId));
  if (filters.status) conditions.push(eq(contentItems.status, filters.status));
  if (filters.undated) conditions.push(isNull(contentItems.publishDate));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    conditions.push(
      or(
        sql`lower(${contentItems.title}) like ${text} escape '\\'`,
        sql`lower(${contentItems.ideaNotes}) like ${text} escape '\\'`,
        sql`lower(${contentItems.script}) like ${text} escape '\\'`,
        sql`lower(${contentItems.caption}) like ${text} escape '\\'`,
      ),
    );
  }
  return and(...conditions);
}

const listColumns = {
  id: contentItems.id,
  title: contentItems.title,
  clientId: contentItems.clientId,
  clientName: clients.name,
  network: contentItems.network,
  format: contentItems.format,
  status: contentItems.status,
  approvalStatus: contentItems.approvalStatus,
  ownerId: contentItems.ownerId,
  ownerName: users.name,
  publishDate: contentItems.publishDate,
  recordDate: contentItems.recordDate,
  editDeadline: contentItems.editDeadline,
};

function baseSelect() {
  return db
    .select(listColumns)
    .from(contentItems)
    .leftJoin(clients, eq(contentItems.clientId, clients.id))
    .leftJoin(users, eq(contentItems.ownerId, users.id));
}

/** Lista paginada: primeiro o que ainda não tem data (banco de ideias), depois as datas mais recentes. */
export async function listContent(filters: ContentFilters & { page?: number }): Promise<{ rows: ContentListItem[]; total: number; page: number; pageSize: number }> {
  const where = contentWhere(filters);
  const [{ total }] = await db.select({ total: count() }).from(contentItems).where(where);
  const pageCount = Math.max(1, Math.ceil(total / CONTENT_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await baseSelect()
    .where(where)
    .orderBy(sql`${contentItems.publishDate} is null desc`, desc(contentItems.publishDate), desc(contentItems.id))
    .limit(CONTENT_PAGE_SIZE)
    .offset((page - 1) * CONTENT_PAGE_SIZE);
  return { rows, total, page, pageSize: CONTENT_PAGE_SIZE };
}

/** Marcações do calendário (publicação, gravação, prazo de edição) dentro da janela, já filtradas. */
export async function listCalendar(
  filters: ContentFilters,
  from: ISODate,
  to: ISODate,
): Promise<{ entries: (ContentCalendarEntry & { item: ContentListItem })[]; undatedCount: number }> {
  const where = contentWhere({ ...filters, undated: false });
  const dateInRange = or(
    sql`${contentItems.publishDate} between ${from} and ${to}`,
    sql`${contentItems.recordDate} between ${from} and ${to}`,
    sql`${contentItems.editDeadline} between ${from} and ${to}`,
  );
  const [rows, [{ undated }]] = await Promise.all([
    baseSelect().where(and(where, dateInRange)).orderBy(asc(contentItems.id)),
    db
      .select({ undated: count() })
      .from(contentItems)
      .where(and(contentWhere({ ...filters, status: filters.status }), isNull(contentItems.publishDate), ne(contentItems.status, "publicado"))),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const entries = buildCalendarEntries(rows, from, to).map((entry) => ({ ...entry, item: byId.get(entry.id)! }));
  return { entries, undatedCount: undated };
}

/** Itens para o quadro: tudo que está em andamento + os últimos publicados. */
export async function listBoard(filters: ContentFilters): Promise<{ rows: ContentListItem[]; hiddenPublished: number }> {
  const base = { ...filters, status: undefined, undated: false };
  const where = contentWhere(base);
  const open = await baseSelect()
    .where(and(where, ne(contentItems.status, "publicado")))
    .orderBy(sql`${contentItems.publishDate} is null`, asc(contentItems.publishDate), asc(contentItems.id));
  const published = await baseSelect()
    .where(and(where, eq(contentItems.status, "publicado")))
    .orderBy(desc(contentItems.publishDate), desc(contentItems.id))
    .limit(BOARD_PUBLISHED_LIMIT);
  const [{ total }] = await db
    .select({ total: count() })
    .from(contentItems)
    .where(and(where, eq(contentItems.status, "publicado")));
  return { rows: [...open, ...published], hiddenPublished: Math.max(0, total - published.length) };
}

export type ContentDetail = ContentItem & { clientName: string | null; ownerName: string | null };

export async function getContentItem(id: number): Promise<ContentDetail | null> {
  const [row] = await db
    .select({ item: contentItems, clientName: clients.name, ownerName: users.name })
    .from(contentItems)
    .leftJoin(clients, eq(contentItems.clientId, clients.id))
    .leftJoin(users, eq(contentItems.ownerId, users.id))
    .where(eq(contentItems.id, id))
    .limit(1);
  return row ? { ...row.item, clientName: row.clientName, ownerName: row.ownerName } : null;
}

// ------------------------------------------------------------------ mutações
export type ContentInput = {
  title: string;
  clientId: number | null;
  network: ContentNetwork;
  format: ContentFormat;
  status: ContentStatus;
  ideaNotes: string;
  script: string;
  caption: string;
  cta: string;
  recordDate: string | null;
  editDeadline: string | null;
  publishDate: string | null;
  approvalStatus: ApprovalStatus;
  ownerId: number | null;
  assetUrl: string;
  notes: string;
};

/** Cliente e responsável escolhidos precisam existir (e o responsável, estar ativo). Devolve a mensagem de erro por campo. */
export async function checkContentRefs(input: Pick<ContentInput, "clientId" | "ownerId">): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (input.clientId) {
    const [row] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId)).limit(1);
    if (!row) errors.clientId = "Este cliente não existe mais.";
  }
  if (input.ownerId) {
    const [row] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.ownerId), eq(users.active, true))).limit(1);
    if (!row) errors.ownerId = "Este responsável não está disponível.";
  }
  return errors;
}

export async function createContentItem(input: ContentInput): Promise<ContentItem> {
  const [row] = await db.insert(contentItems).values(input).returning();
  return row;
}

export async function updateContentItem(id: number, input: ContentInput): Promise<ContentItem | null> {
  const [row] = await db
    .update(contentItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(contentItems.id, id))
    .returning();
  return row ?? null;
}

/** Muda só o status (quadro). Ao publicar sem data de publicação, preenche com `today`. */
export async function setContentStatus(id: number, status: ContentStatus, today: ISODate): Promise<ContentItem | null> {
  const [current] = await db.select({ publishDate: contentItems.publishDate }).from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!current) return null;
  const [row] = await db
    .update(contentItems)
    .set({ status, publishDate: publishDateForStatus(status, current.publishDate, today), updatedAt: new Date() })
    .where(eq(contentItems.id, id))
    .returning();
  return row ?? null;
}

/** Cópia como nova ideia: sem datas, aprovação pendente (o resto — roteiro, legenda, link — vai junto). */
export async function duplicateContentItem(id: number): Promise<ContentItem | null> {
  const original = await getContentItem(id);
  if (!original) return null;
  const { id: _id, createdAt: _c, updatedAt: _u, clientName: _cn, ownerName: _on, ...rest } = original;
  const [row] = await db
    .insert(contentItems)
    .values({ ...rest, title: copyTitle(original.title), status: "ideia", approvalStatus: "pendente", recordDate: null, editDeadline: null, publishDate: null })
    .returning();
  return row;
}

export async function deleteContentItem(id: number): Promise<ContentItem | null> {
  const [row] = await db.delete(contentItems).where(eq(contentItems.id, id)).returning();
  return row ?? null;
}
