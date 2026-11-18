/** Leitura da trilha de auditoria (`audit_log`) para o painel. Só leitura — a trilha nunca é editada. */
import "server-only";
import { and, count, desc, eq, gte, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, type AuditLogEntry } from "@/db/schema";
import { dayStartMs, nextDayStartMs } from "./logic";

export const AUDIT_PAGE_SIZE = 30;

export type AuditFilters = {
  /** id do usuário; `0` = ações sem usuário (visitantes, sistema). */
  userId?: number;
  action?: string;
  entity?: string;
  /** `YYYY-MM-DD` (inclusivo), no fuso do estúdio. */
  from?: string;
  to?: string;
  /** Busca no resumo. */
  q?: string;
  page?: number;
};

const timezone = () => process.env.APP_TIMEZONE || "America/Sao_Paulo";
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

function where(filters: AuditFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (filters.userId === 0) conditions.push(isNull(auditLog.userId));
  else if (filters.userId) conditions.push(eq(auditLog.userId, filters.userId));
  if (filters.action) conditions.push(eq(auditLog.action, filters.action));
  if (filters.entity) conditions.push(eq(auditLog.entity, filters.entity));
  if (filters.from) conditions.push(gte(auditLog.createdAt, new Date(dayStartMs(filters.from, timezone()))));
  if (filters.to) conditions.push(lt(auditLog.createdAt, new Date(nextDayStartMs(filters.to, timezone()))));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    conditions.push(or(sql`lower(coalesce(${auditLog.summary}, '')) like ${text} escape '\\'`, sql`lower(coalesce(${auditLog.userName}, '')) like ${text} escape '\\'`));
  }
  return and(...conditions);
}

export async function listAudit(filters: AuditFilters = {}): Promise<{ rows: AuditLogEntry[]; total: number; page: number; pageSize: number }> {
  const condition = where(filters);
  const [{ total }] = await db.select({ total: count() }).from(auditLog).where(condition);
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select()
    .from(auditLog)
    .where(condition)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset((page - 1) * AUDIT_PAGE_SIZE);
  return { rows, total, page, pageSize: AUDIT_PAGE_SIZE };
}

/** Valores que existem na trilha, para montar os filtros (ações, entidades e quem agiu). */
export async function auditFilterOptions(): Promise<{ actions: string[]; entities: string[]; users: { id: number; name: string }[] }> {
  const [actions, entities, people] = await Promise.all([
    db.selectDistinct({ value: auditLog.action }).from(auditLog).orderBy(auditLog.action),
    db.selectDistinct({ value: auditLog.entity }).from(auditLog).where(isNotNull(auditLog.entity)).orderBy(auditLog.entity),
    db.selectDistinct({ id: auditLog.userId, name: auditLog.userName }).from(auditLog).where(isNotNull(auditLog.userId)),
  ]);
  const byId = new Map<number, string>();
  for (const person of people) if (person.id !== null && !byId.has(person.id)) byId.set(person.id, person.name ?? `Usuário #${person.id}`);
  return {
    actions: actions.map((row) => row.value),
    entities: entities.map((row) => row.value).filter((value): value is string => Boolean(value)),
    users: [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
