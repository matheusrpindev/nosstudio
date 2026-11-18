/**
 * Leads no PAINEL: consultas e mutações. (O recebimento pelo site público fica em `create-lead.ts`/`actions.ts`.)
 *
 * Padrão dos módulos do painel — copie este arquivo como ponto de partida:
 * - este arquivo só fala com o banco: recebe dados JÁ validados e devolve linhas tipadas;
 * - quem autoriza (`requireUser`), valida (zod), audita (`logAudit`) e navega (`refresh`/`redirect`) são as
 *   Server Actions em `src/app/painel/leads/actions.ts`; as páginas chamam as consultas daqui direto.
 */
import "server-only";
import { and, count, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clientInteractions, clients, leads, type Lead } from "@/db/schema";
import { formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { CONTACT_SOURCE_LABELS, SERVICE_INTEREST_LABELS, type ContactSource, type LeadStatus, type ServiceInterest } from "@/lib/domain";
import { onlyDigits } from "@/lib/format";

export const LEADS_PAGE_SIZE = 20;

// ------------------------------------------------------------------ consultas
export type LeadFilters = {
  status?: LeadStatus;
  service?: ServiceInterest;
  /** Busca livre: nome, e-mail ou WhatsApp. */
  q?: string;
  /** Página (começa em 1). */
  page?: number;
};

export type LeadListItem = Pick<Lead, "id" | "name" | "whatsapp" | "serviceInterest" | "source" | "status" | "eventDate" | "city" | "readAt" | "createdAt">;

/** `%` e `_` digitados pelo usuário não podem virar curingas do LIKE. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

function leadWhere(filters: LeadFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (filters.status) conditions.push(eq(leads.status, filters.status));
  if (filters.service) conditions.push(eq(leads.serviceInterest, filters.service));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    const digits = onlyDigits(q);
    conditions.push(
      or(
        sql`lower(${leads.name}) like ${text} escape '\\'`,
        sql`lower(coalesce(${leads.email}, '')) like ${text} escape '\\'`,
        // o WhatsApp é gravado só com dígitos: "(11) 91234" acha "1191234…"
        digits.length >= 3 ? sql`${leads.whatsapp} like ${likePattern(digits)} escape '\\'` : undefined,
      ),
    );
  }
  return and(...conditions);
}

/** Lista paginada, mais recentes primeiro. */
export async function listLeads(filters: LeadFilters = {}): Promise<{ rows: LeadListItem[]; total: number; page: number; pageSize: number }> {
  const where = leadWhere(filters);
  const [{ total }] = await db.select({ total: count() }).from(leads).where(where);
  const pageCount = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      whatsapp: leads.whatsapp,
      serviceInterest: leads.serviceInterest,
      source: leads.source,
      status: leads.status,
      eventDate: leads.eventDate,
      city: leads.city,
      readAt: leads.readAt,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(LEADS_PAGE_SIZE)
    .offset((page - 1) * LEADS_PAGE_SIZE);
  return { rows, total, page, pageSize: LEADS_PAGE_SIZE };
}

/** Leads com status "novo" (contador do menu e da visão geral). */
export async function countNewLeads(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(leads).where(eq(leads.status, "novo"));
  return row?.total ?? 0;
}

export type LeadDetail = Lead & { client: { id: number; name: string } | null };

export async function getLead(id: number): Promise<LeadDetail | null> {
  const [row] = await db
    .select({ lead: leads, clientName: clients.name })
    .from(leads)
    .leftJoin(clients, eq(clients.id, leads.clientId))
    .where(eq(leads.id, id));
  if (!row) return null;
  return { ...row.lead, client: row.lead.clientId && row.clientName != null ? { id: row.lead.clientId, name: row.clientName } : null };
}

// ------------------------------------------------------------------ mutações
/** Marca como lido (só na primeira vez). Devolve `true` se mudou algo. */
export async function markLeadRead(id: number): Promise<boolean> {
  const updated = await db
    .update(leads)
    .set({ readAt: new Date() })
    .where(and(eq(leads.id, id), isNull(leads.readAt)))
    .returning({ id: leads.id });
  return updated.length > 0;
}

export type ManualLeadInput = {
  name: string;
  whatsapp: string;
  email: string;
  serviceInterest: ServiceInterest;
  source: ContactSource;
  eventDate: string | null;
  city: string;
  message: string;
};

/** Contato cadastrado à mão (chegou por WhatsApp, Instagram, indicação…). Já nasce lido: quem cadastrou viu. */
export async function createManualLead(input: ManualLeadInput): Promise<Lead> {
  const [lead] = await db
    .insert(leads)
    .values({
      name: input.name,
      whatsapp: onlyDigits(input.whatsapp),
      email: input.email || null,
      serviceInterest: input.serviceInterest,
      source: input.source,
      eventDate: input.eventDate,
      city: input.city || null,
      message: input.message,
      status: "novo",
      readAt: new Date(),
      // sem consentAt/consentVersion: o consentimento da política só existe para quem enviou o formulário do site
    })
    .returning();
  return lead;
}

export async function setLeadStatus(id: number, status: LeadStatus): Promise<Lead | null> {
  const [lead] = await db.update(leads).set({ status }).where(eq(leads.id, id)).returning();
  return lead ?? null;
}

/** Resumo do pedido, gravado como primeira interação no histórico do cliente. */
export function leadRequestSummary(lead: Lead): string {
  const details = lead.details ?? {};
  const lines = [
    `Primeiro contato recebido em ${formatDateTime(lead.createdAt)} (origem: ${CONTACT_SOURCE_LABELS[lead.source]}).`,
    `Interesse: ${SERVICE_INTEREST_LABELS[lead.serviceInterest]}.`,
    details.packageName ? `Pacote/serviço de origem: ${details.packageName}.` : "",
    lead.eventDate ? `Data do evento: ${formatDate(lead.eventDate)}.` : "",
    details.eventType ? `Tipo de evento: ${details.eventType}.` : "",
    details.eventLocation ? `Local: ${details.eventLocation}.` : "",
    details.guests ? `Convidados: ${details.guests}.` : "",
    details.startTime || details.endTime ? `Horário: ${details.startTime ?? "?"}–${details.endTime ?? "?"}.` : "",
    details.coverage ? `Cobertura: ${details.coverage}.` : "",
    details.storymaker ? `Storymaker: ${details.storymaker}.` : "",
    lead.message.trim() ? `Mensagem: “${lead.message.trim()}”` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export type ConvertResult = { ok: true; clientId: number; created: boolean } | { ok: false; reason: "not_found" };

/**
 * Converte o lead em cliente, numa transação: cria o cliente com os dados do lead, registra a interação inicial
 * e marca o lead como "convertido". Se o lead já tinha cliente, só devolve o id (não duplica).
 */
export async function convertLeadToClient(leadId: number, userId: number): Promise<ConvertResult> {
  return db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(eq(leads.id, leadId));
    if (!lead) return { ok: false, reason: "not_found" } as const;
    if (lead.clientId) return { ok: true, clientId: lead.clientId, created: false } as const;

    const [client] = await tx
      .insert(clients)
      .values({
        name: lead.name,
        whatsapp: lead.whatsapp,
        email: lead.email ?? "",
        city: lead.city ?? "",
        source: lead.source,
        serviceInterest: lead.serviceInterest,
        status: "novo_contato",
        firstContactAt: todayISO(),
        ownerId: userId,
      })
      .returning({ id: clients.id });
    await tx.insert(clientInteractions).values({ clientId: client.id, userId, kind: "nota", content: leadRequestSummary(lead) });
    await tx
      .update(leads)
      .set({ status: "convertido", clientId: client.id, readAt: lead.readAt ?? new Date() })
      .where(eq(leads.id, lead.id));
    return { ok: true, clientId: client.id, created: true } as const;
  });
}

/** Exclusão definitiva (LGPD: pedido de eliminação). Devolve a linha apagada, ou `null` se não existia. */
export async function deleteLead(id: number): Promise<Pick<Lead, "id" | "name"> | null> {
  const [deleted] = await db.delete(leads).where(eq(leads.id, id)).returning({ id: leads.id, name: leads.name });
  return deleted ?? null;
}
