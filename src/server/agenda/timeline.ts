/**
 * LINHA DO TEMPO DE PROJETOS — uma linha por projeto ativo, com os marcos do cadastro (início, evento, prazo de
 * gravação, prazo de entrega, entrega feita) e os compromissos ligados ao projeto.
 *
 * Escopo: os projetos saem de `moduleScope(viewer, "projetos", "ver")` (o funcionário só vê os dele); os
 * compromissos vêm de `listAgenda`, que já aplica o alcance e a privacidade da agenda (particular de outra
 * pessoa nunca aparece ligado a um projeto: o item mascarado não carrega o projeto).
 */
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { projectMilestones, type Milestone } from "@/lib/agenda/timeline";
import type { AgendaItem } from "@/lib/agenda/view";
import { toISODate, type ISODate } from "@/lib/dates";
import { PROJECT_OPEN_STAGES, type ProjectStage } from "@/lib/domain";
import { inScope, moduleScope } from "@/server/access/scope";
import type { AgendaViewer } from "./access";
import { listAgenda, listCalendars } from "./queries";

export type TimelineRow = {
  id: number;
  title: string;
  clientName: string | null;
  stage: ProjectStage;
  href: string;
  milestones: Milestone[];
  /** Compromissos do projeto dentro da janela (ocorrências, já pela privacidade). */
  events: AgendaItem[];
};

export async function getProjectTimeline(viewer: AgendaViewer, from: ISODate, to: ISODate, today: ISODate, filters: { clientId?: number | null; projectId?: number | null } = {}): Promise<TimelineRow[]> {
  const scope = await moduleScope(viewer, "projetos", "ver");
  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      stage: projects.stage,
      clientName: clients.name,
      createdAt: projects.createdAt,
      eventDate: projects.eventDate,
      shootDeadline: projects.shootDeadline,
      deliveryDeadline: projects.deliveryDeadline,
      deliveredAt: projects.deliveredAt,
    })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        inArray(projects.stage, [...PROJECT_OPEN_STAGES]),
        inScope(projects.id, scope),
        filters.clientId ? eq(projects.clientId, filters.clientId) : undefined,
        filters.projectId ? eq(projects.id, filters.projectId) : undefined,
      ),
    )
    .orderBy(asc(projects.deliveryDeadline), asc(projects.id));
  if (rows.length === 0) return [];

  const calendars = await listCalendars();
  const items = await listAgenda(viewer, from, to, { calendarIds: calendars.map((calendar) => calendar.id), layers: [] });
  const byProject = new Map<number, AgendaItem[]>();
  for (const item of items) {
    if (item.source !== "event" || item.masked || item.projectId === null) continue;
    byProject.set(item.projectId, [...(byProject.get(item.projectId) ?? []), item]);
  }

  const withDates = rows.map((row) => ({
    id: row.id,
    title: row.title,
    clientName: row.clientName,
    stage: row.stage,
    href: `/painel/projetos/${row.id}`,
    milestones: projectMilestones(
      { startedOn: toISODate(row.createdAt), eventDate: row.eventDate, shootDeadline: row.shootDeadline, deliveryDeadline: row.deliveryDeadline, deliveredAt: row.deliveredAt },
      today,
    ),
    events: byProject.get(row.id) ?? [],
  }));
  // quem tem prazo de entrega vem primeiro (o mais próximo antes); sem prazo, no fim
  const delivery = (row: (typeof withDates)[number]) => row.milestones.find((mark) => mark.kind === "entrega")?.date ?? "9999-12-31";
  return withDates.sort((a, b) => delivery(a).localeCompare(delivery(b)) || a.id - b.id);
}
