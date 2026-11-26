/**
 * CAMADAS DERIVADAS da agenda (somente leitura): nada aqui é gravado em `agenda_events`. Cada camada lê o módulo
 * de origem na hora e só existe para quem pode ver esse módulo.
 *
 * - prazos: datas dos projetos (evento, prazo de gravação, prazo de entrega) — `projetos:ver`;
 * - editorial: publicações do calendário de conteúdo — `conteudo:ver`;
 * - financeira: contas a pagar e a receber ainda em aberto e fim de vigência de contratos — `financeiro:ver`
 *   (os contratos, também `contratos:ver`). Desligada por padrão.
 */
import "server-only";
import { and, between, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { agendaCalendars, clients, contentItems, contracts, financeEntries, projects, users } from "@/db/schema";
import type { AgendaItem } from "@/lib/agenda/view";
import type { ISODate } from "@/lib/dates";
import {
  AGENDA_LAYERS,
  AGENDA_LAYER_LABELS,
  CONTENT_FORMAT_LABELS,
  CONTENT_NETWORK_LABELS,
  type AgendaColor,
  type AgendaLayer,
} from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import { canEverywhere, type PermissionSubject } from "@/lib/permissions";
import { projectDeadlineEntries, type ProjectDeadlineRow } from "./logic";

export type LayerFilters = { clientId?: number | null; projectId?: number | null; personId?: number | null };
export type LayerInfo = { id: AgendaLayer; label: string; color: AgendaColor; description: string };

const PRAZOS_COLOR: AgendaColor = "vermelho";
const DESCRIPTIONS: Record<AgendaLayer, string> = {
  prazos: "Datas de evento, gravação e entrega dos projetos",
  editorial: "Publicações do calendário de conteúdo",
  financeira: "Contas a pagar e a receber em aberto e fim de vigência de contratos",
};

/** Camadas que esta pessoa pode ligar, com o nome e a cor da agenda correspondente (Financeira e Editorial). */
export async function getAvailableLayers(viewer: PermissionSubject): Promise<LayerInfo[]> {
  const derived = await db
    .select({ kind: agendaCalendars.kind, name: agendaCalendars.name, color: agendaCalendars.color, active: agendaCalendars.active })
    .from(agendaCalendars)
    .where(or(eq(agendaCalendars.kind, "financeira"), eq(agendaCalendars.kind, "editorial")));
  const calendarOf = (kind: "financeira" | "editorial") => derived.find((row) => row.kind === kind);
  const allowed: Record<AgendaLayer, boolean> = {
    prazos: canEverywhere(viewer, "projetos", "ver"),
    editorial: canEverywhere(viewer, "conteudo", "ver") && calendarOf("editorial")?.active !== false,
    financeira: canEverywhere(viewer, "financeiro", "ver") && calendarOf("financeira")?.active !== false,
  };
  return AGENDA_LAYERS.filter((layer) => allowed[layer]).map((layer) => {
    const calendar = layer === "prazos" ? undefined : calendarOf(layer);
    return {
      id: layer,
      label: calendar?.name ?? AGENDA_LAYER_LABELS[layer],
      color: calendar?.color ?? (layer === "prazos" ? PRAZOS_COLOR : layer === "editorial" ? "ciano" : "verde"),
      description: DESCRIPTIONS[layer],
    };
  });
}

const base = { endTime: null, icon: null, masked: false, status: null, priority: null, recurring: false, categoryId: null, calendarId: null, people: [] as string[], ownerName: null, editable: false, seriesStart: null, projectId: null as number | null };

async function deadlineItems(from: ISODate, to: ISODate, filters: LayerFilters, color: AgendaColor): Promise<AgendaItem[]> {
  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      stage: projects.stage,
      eventDate: projects.eventDate,
      shootDeadline: projects.shootDeadline,
      deliveryDeadline: projects.deliveryDeadline,
      deliveredAt: projects.deliveredAt,
      location: projects.location,
      clientName: clients.name,
      ownerName: users.name,
    })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(
      and(
        or(between(projects.eventDate, from, to), between(projects.shootDeadline, from, to), between(projects.deliveryDeadline, from, to)),
        filters.clientId ? eq(projects.clientId, filters.clientId) : undefined,
        filters.projectId ? eq(projects.id, filters.projectId) : undefined,
        filters.personId ? eq(projects.ownerId, filters.personId) : undefined,
      ),
    );
  return projectDeadlineEntries(rows satisfies ProjectDeadlineRow[], from, to).map((entry) => ({
    ...base,
    key: entry.key,
    source: "deadline" as const,
    id: entry.id,
    title: entry.title,
    date: entry.date,
    endDate: entry.date,
    startTime: null,
    color,
    href: entry.href,
    label: entry.deadlineLabel ?? "Prazo de projeto",
    location: entry.location,
    clientName: entry.clientName,
    people: entry.ownerName ? [entry.ownerName] : [],
    projectId: entry.id,
  }));
}

async function editorialItems(from: ISODate, to: ISODate, filters: LayerFilters, color: AgendaColor): Promise<AgendaItem[]> {
  if (filters.projectId) return []; // conteúdo não é ligado a projeto
  const rows = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      network: contentItems.network,
      format: contentItems.format,
      publishDate: contentItems.publishDate,
      clientName: clients.name,
      ownerName: users.name,
    })
    .from(contentItems)
    .leftJoin(clients, eq(clients.id, contentItems.clientId))
    .leftJoin(users, eq(users.id, contentItems.ownerId))
    .where(
      and(
        between(contentItems.publishDate, from, to),
        filters.clientId ? eq(contentItems.clientId, filters.clientId) : undefined,
        filters.personId ? eq(contentItems.ownerId, filters.personId) : undefined,
      ),
    );
  return rows.map((row) => ({
    ...base,
    key: `c-${row.id}`,
    source: "editorial" as const,
    id: row.id,
    title: row.title,
    date: row.publishDate as ISODate,
    endDate: row.publishDate as ISODate,
    startTime: null,
    color,
    href: `/painel/conteudo/${row.id}`,
    label: `Publicação · ${CONTENT_NETWORK_LABELS[row.network]} · ${CONTENT_FORMAT_LABELS[row.format]}`,
    location: "",
    clientName: row.clientName,
    people: row.ownerName ? [row.ownerName] : [],
  }));
}

async function financeItems(viewer: PermissionSubject, from: ISODate, to: ISODate, filters: LayerFilters, color: AgendaColor): Promise<AgendaItem[]> {
  if (filters.personId) return []; // lançamentos e contratos não têm responsável
  const [entries, contractRows] = await Promise.all([
    db
      .select({
        id: financeEntries.id,
        type: financeEntries.type,
        description: financeEntries.description,
        amountCents: financeEntries.amountCents,
        dueDate: financeEntries.dueDate,
        clientName: clients.name,
      })
      .from(financeEntries)
      .leftJoin(clients, eq(clients.id, financeEntries.clientId))
      .where(
        and(
          isNull(financeEntries.paidAt),
          between(financeEntries.dueDate, from, to),
          filters.clientId ? eq(financeEntries.clientId, filters.clientId) : undefined,
          filters.projectId ? eq(financeEntries.projectId, filters.projectId) : undefined,
        ),
      ),
    canEverywhere(viewer, "contratos", "ver")
      ? db
          .select({ id: contracts.id, title: contracts.title, validUntil: contracts.validUntil, clientName: clients.name })
          .from(contracts)
          .leftJoin(clients, eq(clients.id, contracts.clientId))
          .where(
            and(
              eq(contracts.isTemplate, false),
              ne(contracts.status, "cancelado"),
              between(contracts.validUntil, from, to),
              filters.clientId ? eq(contracts.clientId, filters.clientId) : undefined,
              filters.projectId ? eq(contracts.projectId, filters.projectId) : undefined,
            ),
          )
      : Promise.resolve([]),
  ]);
  return [
    ...entries.map((row) => ({
      ...base,
      key: `f-${row.id}`,
      source: "finance" as const,
      id: row.id,
      title: row.description,
      date: row.dueDate,
      endDate: row.dueDate,
      startTime: null,
      color,
      href: `/painel/financeiro/${row.id}`,
      label: `${row.type === "receita" ? "A receber" : "A pagar"} · ${formatBRL(row.amountCents)}`,
      location: "",
      clientName: row.clientName,
    })),
    ...contractRows.map((row) => ({
      ...base,
      key: `k-${row.id}`,
      source: "finance" as const,
      id: row.id,
      title: row.title,
      date: row.validUntil as ISODate,
      endDate: row.validUntil as ISODate,
      startTime: null,
      color,
      href: `/painel/contratos/${row.id}`,
      label: "Fim de vigência do contrato",
      location: "",
      clientName: row.clientName,
    })),
  ];
}

/** Itens das camadas ligadas, já conferindo se a pessoa pode ver cada uma. */
export async function listLayerItems(
  viewer: PermissionSubject,
  from: ISODate,
  to: ISODate,
  layers: readonly AgendaLayer[],
  filters: LayerFilters = {},
): Promise<AgendaItem[]> {
  if (layers.length === 0) return [];
  const available = await getAvailableLayers(viewer);
  const groups = await Promise.all(
    available
      .filter((layer) => layers.includes(layer.id))
      .map((layer) => {
        if (layer.id === "prazos") return deadlineItems(from, to, filters, layer.color);
        if (layer.id === "editorial") return editorialItems(from, to, filters, layer.color);
        return financeItems(viewer, from, to, filters, layer.color);
      }),
  );
  return groups.flat();
}
