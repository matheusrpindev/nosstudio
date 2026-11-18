/**
 * Visão geral do painel — só leitura. Consultas diretas (sem cache): a página roda a cada visita.
 * Quem chama deve ter passado por `requireUser()` (e portanto `todayISO()` já é seguro).
 */
import "server-only";
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents, clients, faqs, financeEntries, leads, projects, proposals, tasks } from "@/db/schema";
import { smtpConfigured } from "@/lib/env";
import { addDays, type ISODate } from "@/lib/dates";
import { CLIENT_ACTIVE_STATUSES, PROJECT_OPEN_STAGES, type AgendaKind, type TaskPriority } from "@/lib/domain";
import { getSiteContentForEdit } from "@/server/site/content";
import { PROPOSAL_SOON_DAYS, sortImportantTasks } from "./logic";

const num = (value: number | null | undefined) => Number(value ?? 0);

// ------------------------------------------------------------------ cartões
export type DashboardSummary = {
  newLeads: number;
  proposals: { waiting: number; overdue: number; soon: number };
  activeClients: number;
  deliveries: { pending: number; overdue: number; nextDate: ISODate | null };
  receivables: { count: number; totalCents: number; overdueCount: number; overdueCents: number };
};

export async function getSummary(today: ISODate): Promise<DashboardSummary> {
  const soonLimit = addDays(today, PROPOSAL_SOON_DAYS);
  const [[lead], [prop], [client], [deliv], [recv]] = await Promise.all([
    db.select({ n: count() }).from(leads).where(eq(leads.status, "novo")),
    db
      .select({
        waiting: count(),
        overdue: sql<number>`coalesce(sum(case when ${proposals.validUntil} < ${today} then 1 else 0 end), 0)`,
        soon: sql<number>`coalesce(sum(case when ${proposals.validUntil} >= ${today} and ${proposals.validUntil} <= ${soonLimit} then 1 else 0 end), 0)`,
      })
      .from(proposals)
      .where(and(eq(proposals.status, "enviada"), eq(proposals.isTemplate, false))),
    db.select({ n: count() }).from(clients).where(inArray(clients.status, [...CLIENT_ACTIVE_STATUSES])),
    db
      .select({
        pending: count(),
        overdue: sql<number>`coalesce(sum(case when ${projects.deliveryDeadline} < ${today} then 1 else 0 end), 0)`,
        nextDate: sql<string | null>`min(case when ${projects.deliveryDeadline} >= ${today} then ${projects.deliveryDeadline} end)`,
      })
      .from(projects)
      .where(and(inArray(projects.stage, [...PROJECT_OPEN_STAGES]), isNotNull(projects.deliveryDeadline))),
    db
      .select({
        n: count(),
        total: sql<number>`coalesce(sum(${financeEntries.amountCents}), 0)`,
        overdueN: sql<number>`coalesce(sum(case when ${financeEntries.dueDate} < ${today} then 1 else 0 end), 0)`,
        overdueTotal: sql<number>`coalesce(sum(case when ${financeEntries.dueDate} < ${today} then ${financeEntries.amountCents} else 0 end), 0)`,
      })
      .from(financeEntries)
      .where(and(eq(financeEntries.type, "receita"), isNull(financeEntries.paidAt))),
  ]);

  return {
    newLeads: num(lead?.n),
    proposals: { waiting: num(prop?.waiting), overdue: num(prop?.overdue), soon: num(prop?.soon) },
    activeClients: num(client?.n),
    deliveries: { pending: num(deliv?.pending), overdue: num(deliv?.overdue), nextDate: deliv?.nextDate ?? null },
    receivables: { count: num(recv?.n), totalCents: num(recv?.total), overdueCount: num(recv?.overdueN), overdueCents: num(recv?.overdueTotal) },
  };
}

// ------------------------------------------------------------------- agenda
export type DashboardEvent = {
  id: number;
  title: string;
  kind: AgendaKind;
  date: ISODate;
  startTime: string | null;
  endTime: string | null;
  location: string;
  clientName: string | null;
};

const eventColumns = {
  id: agendaEvents.id,
  title: agendaEvents.title,
  kind: agendaEvents.kind,
  date: agendaEvents.date,
  startTime: agendaEvents.startTime,
  endTime: agendaEvents.endTime,
  location: agendaEvents.location,
  clientName: clients.name,
};

/** Compromissos de `from` até `to` (inclusive), por data e horário (dia inteiro primeiro). */
export async function listEvents(from: ISODate, to: ISODate, kinds?: AgendaKind[], limit = 60): Promise<DashboardEvent[]> {
  return db
    .select(eventColumns)
    .from(agendaEvents)
    .leftJoin(clients, eq(clients.id, agendaEvents.clientId))
    .where(and(sql`${agendaEvents.date} >= ${from}`, lte(agendaEvents.date, to), kinds ? inArray(agendaEvents.kind, kinds) : undefined))
    .orderBy(asc(agendaEvents.date), sql`${agendaEvents.startTime} is not null`, asc(agendaEvents.startTime), asc(agendaEvents.id))
    .limit(limit);
}

// ------------------------------------------------------------------- tarefas
export type DashboardTask = {
  id: number;
  title: string;
  dueDate: ISODate | null;
  priority: TaskPriority;
  clientName: string | null;
  projectTitle: string | null;
  projectId: number | null;
};

export async function listImportantTasks(today: ISODate, limit = 8): Promise<{ tasks: DashboardTask[]; total: number }> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      clientName: clients.name,
      projectTitle: projects.title,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .leftJoin(clients, eq(clients.id, tasks.clientId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.done, false), or(and(isNotNull(tasks.dueDate), lte(tasks.dueDate, today)), eq(tasks.priority, "alta"))))
    .limit(200);
  const sorted = sortImportantTasks(rows, today);
  return { tasks: sorted.slice(0, limit), total: sorted.length };
}

// -------------------------------------------------------------------- avisos
export type NoticeItem = { label: string; href: string; detail?: string };
export type DashboardIssues = {
  overdueProposals: { total: number; items: { id: number; number: string; title: string; clientName: string; validUntil: ISODate }[] };
  overdueDeliveries: { total: number; items: { id: number; title: string; clientName: string | null; deadline: ISODate }[] };
  overduePayables: { total: number; totalCents: number; items: { id: number; description: string; supplier: string; amountCents: number; dueDate: ISODate }[] };
};

export async function getIssues(today: ISODate, perList = 3): Promise<DashboardIssues> {
  const proposalWhere = and(eq(proposals.status, "enviada"), eq(proposals.isTemplate, false), isNotNull(proposals.validUntil), lt(proposals.validUntil, today));
  const deliveryWhere = and(inArray(projects.stage, [...PROJECT_OPEN_STAGES]), isNotNull(projects.deliveryDeadline), lt(projects.deliveryDeadline, today));
  const payableWhere = and(eq(financeEntries.type, "despesa"), isNull(financeEntries.paidAt), lt(financeEntries.dueDate, today));

  const [[pc], pRows, [dc], dRows, [fc], fRows] = await Promise.all([
    db.select({ n: count() }).from(proposals).where(proposalWhere),
    db
      .select({
        id: proposals.id,
        number: proposals.number,
        title: proposals.title,
        displayName: proposals.clientDisplayName,
        clientName: clients.name,
        validUntil: proposals.validUntil,
      })
      .from(proposals)
      .leftJoin(clients, eq(clients.id, proposals.clientId))
      .where(proposalWhere)
      .orderBy(asc(proposals.validUntil))
      .limit(perList),
    db.select({ n: count() }).from(projects).where(deliveryWhere),
    db
      .select({ id: projects.id, title: projects.title, clientName: clients.name, deadline: projects.deliveryDeadline })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(deliveryWhere)
      .orderBy(asc(projects.deliveryDeadline))
      .limit(perList),
    db.select({ n: count(), total: sql<number>`coalesce(sum(${financeEntries.amountCents}), 0)` }).from(financeEntries).where(payableWhere),
    db
      .select({
        id: financeEntries.id,
        description: financeEntries.description,
        supplier: financeEntries.supplier,
        amountCents: financeEntries.amountCents,
        dueDate: financeEntries.dueDate,
      })
      .from(financeEntries)
      .where(payableWhere)
      .orderBy(asc(financeEntries.dueDate))
      .limit(perList),
  ]);

  return {
    overdueProposals: {
      total: num(pc?.n),
      items: pRows.map((r) => ({ id: r.id, number: r.number, title: r.title, clientName: r.displayName || r.clientName || "", validUntil: r.validUntil as ISODate })),
    },
    overdueDeliveries: {
      total: num(dc?.n),
      items: dRows.map((r) => ({ id: r.id, title: r.title, clientName: r.clientName, deadline: r.deadline as ISODate })),
    },
    overduePayables: { total: num(fc?.n), totalCents: num(fc?.total), items: fRows },
  };
}

export type SetupGaps = { whatsapp: boolean; email: boolean; smtp: boolean; faq: boolean };

/** Pendências de configuração (true = falta configurar). */
export async function getSetupGaps(): Promise<SetupGaps> {
  const [general, [faq]] = await Promise.all([
    getSiteContentForEdit("general"),
    db.select({ n: count() }).from(faqs).where(and(eq(faqs.published, true), gt(sql`length(trim(${faqs.answer}))`, 0))),
  ]);
  return {
    whatsapp: general.whatsapp.trim() === "",
    email: general.email.trim() === "",
    smtp: !smtpConfigured(),
    faq: num(faq?.n) === 0,
  };
}
