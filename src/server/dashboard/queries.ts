/**
 * Visão geral do painel — só leitura. Consultas diretas (sem cache): a página roda a cada visita.
 * Quem chama deve ter passado por `requirePanelUser()` (e portanto `todayISO()` já é seguro).
 *
 * PERMISSÕES: a visão geral junta vários módulos, e nem todo mundo vê todos. Cada consulta recebe um
 * `DashboardAccess` (montado por `dashboardAccess(user)`): o que a pessoa não pode ver NÃO É CONSULTADO e volta
 * `null`; projetos e tarefas vêm filtrados pelos projetos que ela alcança (o funcionário só vê os dele).
 */
import "server-only";
import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, faqs, financeEntries, leads, projects, proposals, tasks } from "@/db/schema";
import type { AgendaItem } from "@/lib/agenda/view";
import { smtpConfigured } from "@/lib/env";
import { addDays, type ISODate } from "@/lib/dates";
import { CLIENT_ACTIVE_STATUSES, PROJECT_OPEN_STAGES, type TaskPriority } from "@/lib/domain";
import { canEverywhere, canUsePanelModule, isAdminRole } from "@/lib/permissions";
import { inScope, moduleScope, type AccessUser, type IdScope } from "@/server/access/scope";
import { listRelatedAgenda, productionCategoryIds, type AgendaViewer } from "@/server/agenda-related";
import { getSiteContentForEdit } from "@/server/site/content";
import { PROPOSAL_SOON_DAYS, sortImportantTasks } from "./logic";

const num = (value: number | null | undefined) => Number(value ?? 0);

// ----------------------------------------------------------------- permissões
/** O que esta pessoa pode ver na visão geral. `null` em projetos/tarefas = não vê o módulo. */
export type DashboardAccess = {
  leads: boolean;
  proposals: boolean;
  clients: boolean;
  finance: boolean;
  agenda: boolean;
  site: boolean;
  admin: boolean;
  /** Projetos que a pessoa vê: `"todos"`, só os dela, ou `null` (módulo fechado). */
  projects: IdScope | null;
  /** Tarefas: idem (pelos projetos). */
  tasks: IdScope | null;
};

export async function dashboardAccess(user: AccessUser): Promise<DashboardAccess> {
  const [projects, tasks] = await Promise.all([
    canUsePanelModule(user, "projetos", "ver") ? moduleScope(user, "projetos", "ver") : null,
    canUsePanelModule(user, "tarefas", "ver") ? moduleScope(user, "tarefas", "ver") : null,
  ]);
  return {
    leads: canEverywhere(user, "leads", "ver"),
    proposals: canEverywhere(user, "propostas", "ver"),
    clients: canEverywhere(user, "clientes", "ver"),
    finance: canEverywhere(user, "financeiro", "ver"),
    // módulo INTEIRO: a visão geral não filtra a agenda por projeto (quem só a vê "nos projetos em que está" fica sem o cartão)
    agenda: canEverywhere(user, "agenda", "ver"),
    site: canEverywhere(user, "site", "editar"),
    admin: isAdminRole(user.role),
    projects,
    tasks,
  };
}

// ------------------------------------------------------------------ cartões
/** Cada cartão é `null` quando a pessoa não pode ver o módulo dele (e a consulta nem roda). */
export type DashboardSummary = {
  newLeads: number | null;
  proposals: { waiting: number; overdue: number; soon: number } | null;
  activeClients: number | null;
  deliveries: { pending: number; overdue: number; nextDate: ISODate | null } | null;
  receivables: { count: number; totalCents: number; overdueCount: number; overdueCents: number } | null;
};

export async function getSummary(today: ISODate, access: DashboardAccess): Promise<DashboardSummary> {
  const soonLimit = addDays(today, PROPOSAL_SOON_DAYS);
  const [lead, prop, client, deliv, recv] = await Promise.all([
    access.leads ? db.select({ n: count() }).from(leads).where(eq(leads.status, "novo")) : null,
    access.proposals
      ? db
          .select({
            waiting: count(),
            overdue: sql<number>`coalesce(sum(case when ${proposals.validUntil} < ${today} then 1 else 0 end), 0)`,
            soon: sql<number>`coalesce(sum(case when ${proposals.validUntil} >= ${today} and ${proposals.validUntil} <= ${soonLimit} then 1 else 0 end), 0)`,
          })
          .from(proposals)
          .where(and(eq(proposals.status, "enviada"), eq(proposals.isTemplate, false)))
      : null,
    access.clients ? db.select({ n: count() }).from(clients).where(inArray(clients.status, [...CLIENT_ACTIVE_STATUSES])) : null,
    access.projects
      ? db
          .select({
            pending: count(),
            overdue: sql<number>`coalesce(sum(case when ${projects.deliveryDeadline} < ${today} then 1 else 0 end), 0)`,
            nextDate: sql<string | null>`min(case when ${projects.deliveryDeadline} >= ${today} then ${projects.deliveryDeadline} end)`,
          })
          .from(projects)
          .where(and(inArray(projects.stage, [...PROJECT_OPEN_STAGES]), isNotNull(projects.deliveryDeadline), inScope(projects.id, access.projects)))
      : null,
    access.finance
      ? db
          .select({
            n: count(),
            total: sql<number>`coalesce(sum(${financeEntries.amountCents}), 0)`,
            overdueN: sql<number>`coalesce(sum(case when ${financeEntries.dueDate} < ${today} then 1 else 0 end), 0)`,
            overdueTotal: sql<number>`coalesce(sum(case when ${financeEntries.dueDate} < ${today} then ${financeEntries.amountCents} else 0 end), 0)`,
          })
          .from(financeEntries)
          .where(and(eq(financeEntries.type, "receita"), isNull(financeEntries.paidAt)))
      : null,
  ]);

  return {
    newLeads: lead ? num(lead[0]?.n) : null,
    proposals: prop ? { waiting: num(prop[0]?.waiting), overdue: num(prop[0]?.overdue), soon: num(prop[0]?.soon) } : null,
    activeClients: client ? num(client[0]?.n) : null,
    deliveries: deliv ? { pending: num(deliv[0]?.pending), overdue: num(deliv[0]?.overdue), nextDate: deliv[0]?.nextDate ?? null } : null,
    receivables: recv ? { count: num(recv[0]?.n), totalCents: num(recv[0]?.total), overdueCount: num(recv[0]?.overdueN), overdueCents: num(recv[0]?.overdueTotal) } : null,
  };
}

// ------------------------------------------------------------------- agenda
/**
 * Um compromisso na visão geral: uma OCORRÊNCIA já passada pela privacidade da agenda (`listAgenda`). Particular
 * de outra pessoa chega com `masked: true`, título "Ocupado" e nenhum outro conteúdo.
 */
export type DashboardEvent = AgendaItem;

/** Dias à frente em "Compromissos da semana" (hoje + 6) e em "Próximas gravações e eventos". */
export const WEEK_AHEAD_DAYS = 6;
export const SHOOTS_AHEAD_DAYS = 30;

/**
 * Compromissos de hoje aos próximos 6 dias, por data e horário, com as séries expandidas.
 * Só chame para quem vê a Agenda no módulo inteiro (`access.agenda`): esta consulta não filtra por projeto.
 */
export async function listWeekEvents(viewer: AgendaViewer, today: ISODate, limit = 60): Promise<DashboardEvent[]> {
  return (await listRelatedAgenda(viewer, today, addDays(today, WEEK_AHEAD_DAYS))).slice(0, limit);
}

/**
 * Próximas gravações, sessões, eventos e casamentos (categorias de produção) nos próximos 30 dias.
 * Como a lista é filtrada por categoria, particulares de outra pessoa NÃO entram (nem como "Ocupado"): o filtro
 * revelaria o tipo do compromisso. Mesma ressalva de `listWeekEvents` quanto a `access.agenda`.
 */
export async function listUpcomingShoots(viewer: AgendaViewer, today: ISODate, limit = 6): Promise<DashboardEvent[]> {
  const categoryIds = await productionCategoryIds();
  if (categoryIds.length === 0) return [];
  return (await listRelatedAgenda(viewer, today, addDays(today, SHOOTS_AHEAD_DAYS), { categoryIds })).slice(0, limit);
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

/** Tarefas atrasadas, de hoje e de prioridade alta — só as dos projetos em `scope` (`access.tasks`). */
export async function listImportantTasks(today: ISODate, scope: IdScope, limit = 8): Promise<{ tasks: DashboardTask[]; total: number }> {
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
    .where(and(eq(tasks.done, false), inScope(tasks.projectId, scope), or(and(isNotNull(tasks.dueDate), lte(tasks.dueDate, today)), eq(tasks.priority, "alta"))))
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

const NO_ISSUES = { total: 0, items: [] };

/** Pendências (vencidos e atrasados) só dos módulos que a pessoa vê; os demais voltam vazios sem consultar. */
export async function getIssues(today: ISODate, access: DashboardAccess, perList = 3): Promise<DashboardIssues> {
  const proposalWhere = and(eq(proposals.status, "enviada"), eq(proposals.isTemplate, false), isNotNull(proposals.validUntil), lt(proposals.validUntil, today));
  const deliveryWhere = and(
    inArray(projects.stage, [...PROJECT_OPEN_STAGES]),
    isNotNull(projects.deliveryDeadline),
    lt(projects.deliveryDeadline, today),
    inScope(projects.id, access.projects ?? []),
  );
  const payableWhere = and(eq(financeEntries.type, "despesa"), isNull(financeEntries.paidAt), lt(financeEntries.dueDate, today));

  const [pc, pRows, dc, dRows, fc, fRows] = await Promise.all([
    access.proposals ? db.select({ n: count() }).from(proposals).where(proposalWhere) : [],
    access.proposals
      ? db
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
          .limit(perList)
      : [],
    access.projects ? db.select({ n: count() }).from(projects).where(deliveryWhere) : [],
    access.projects
      ? db
          .select({ id: projects.id, title: projects.title, clientName: clients.name, deadline: projects.deliveryDeadline })
          .from(projects)
          .leftJoin(clients, eq(clients.id, projects.clientId))
          .where(deliveryWhere)
          .orderBy(asc(projects.deliveryDeadline))
          .limit(perList)
      : [],
    access.finance ? db.select({ n: count(), total: sql<number>`coalesce(sum(${financeEntries.amountCents}), 0)` }).from(financeEntries).where(payableWhere) : [],
    access.finance
      ? db
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
          .limit(perList)
      : [],
  ]);

  return {
    overdueProposals: access.proposals
      ? {
          total: num(pc[0]?.n),
          items: pRows.map((r) => ({ id: r.id, number: r.number, title: r.title, clientName: r.displayName || r.clientName || "", validUntil: r.validUntil as ISODate })),
        }
      : NO_ISSUES,
    overdueDeliveries: access.projects
      ? {
          total: num(dc[0]?.n),
          items: dRows.map((r) => ({ id: r.id, title: r.title, clientName: r.clientName, deadline: r.deadline as ISODate })),
        }
      : NO_ISSUES,
    overduePayables: access.finance ? { total: num(fc[0]?.n), totalCents: num(fc[0]?.total), items: fRows } : { ...NO_ISSUES, totalCents: 0 },
  };
}

export type SetupGaps = { whatsapp: boolean; email: boolean; smtp: boolean; faq: boolean };

export const NO_SETUP_GAPS: SetupGaps = { whatsapp: false, email: false, smtp: false, faq: false };

/**
 * Pendências de configuração (true = falta configurar). Só para quem pode resolvê-las: as do site exigem editar
 * o Site; a de SMTP leva a Configurações › Notificações, que é só de administradores e sócios.
 */
export async function getSetupGaps(access: Pick<DashboardAccess, "site" | "admin">): Promise<SetupGaps> {
  if (!access.site && !access.admin) return NO_SETUP_GAPS;
  const [general, [faq]] = await Promise.all([
    getSiteContentForEdit("general"),
    db.select({ n: count() }).from(faqs).where(and(eq(faqs.published, true), gt(sql`length(trim(${faqs.answer}))`, 0))),
  ]);
  return {
    whatsapp: access.site && general.whatsapp.trim() === "",
    email: access.site && general.email.trim() === "",
    smtp: access.admin && !smtpConfigured(),
    faq: access.site && num(faq?.n) === 0,
  };
}
