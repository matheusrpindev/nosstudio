/**
 * A AGENDA VISTA DE FORA DA AGENDA — visão geral, ficha do cliente, projeto, "dados deste titular", exportação.
 *
 * Regra: nenhum módulo fora de `src/server/agenda` lê a tabela `agenda_events` para MOSTRAR ou EXPORTAR um
 * compromisso. Tudo passa pelas consultas de `@/server/agenda/queries` (`listAgenda`, `getEventView`), que
 * aplicam `toVisibleEvent`: um compromisso particular de outra pessoa sai só como "Ocupado" — ou não sai, quando
 * a lista é filtrada por cliente ou projeto (o filtro não pode servir de oráculo do conteúdo). As séries são
 * expandidas em ocorrências pelas mesmas consultas.
 *
 * Daqui a tabela só é consultada para descobrir IDS (nunca título, local, notas…): cada id volta a passar por
 * `getEventView` antes de qualquer campo sair. Teste com sentinelas: `agenda-related.db.test.ts`.
 */
import "server-only";
import { eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents } from "@/db/schema";
import type { AgendaItem } from "@/lib/agenda/view";
import { addDays, type ISODate } from "@/lib/dates";
import type { FullEvent, MaskedEvent, VisibleEvent } from "@/server/agenda/privacy";
import { getEventView, listAgenda, listCalendars, listCategories, type AgendaFilters, type AgendaViewer } from "@/server/agenda/queries";

export type { AgendaViewer } from "@/server/agenda/queries";

/** Janela das listas de "próximos compromissos" e do histórico de um projeto. */
export const RELATED_AHEAD_DAYS = 365;
export const RELATED_BACK_DAYS = 365;

/**
 * Compromissos (ocorrências) entre duas datas, como a tela da agenda os mostraria a esta pessoa: só agendas
 * ativas, sem camadas derivadas, particulares de terceiros mascarados. Os cancelados ficam de fora, a menos que
 * `includeCancelled`.
 */
export async function listRelatedAgenda(
  viewer: AgendaViewer,
  from: ISODate,
  to: ISODate,
  filters: Pick<AgendaFilters, "clientId" | "projectId" | "categoryIds"> = {},
  options: { includeCancelled?: boolean } = {},
): Promise<AgendaItem[]> {
  const calendars = await listCalendars();
  const items = await listAgenda(viewer, from, to, { ...filters, calendarIds: calendars.map((calendar) => calendar.id), layers: [] });
  return items.filter((item) => item.source === "event" && (options.includeCancelled || item.status !== "cancelado"));
}

/**
 * Uma linha por compromisso: de cada série fica a próxima ocorrência a partir de `today` (ou, se a série já
 * acabou, a última). Sem isto, uma reunião semanal ocuparia a lista inteira de "próximos compromissos".
 */
export function collapseSeries(items: readonly AgendaItem[], today: ISODate): AgendaItem[] {
  const chosen = new Map<number, AgendaItem>();
  for (const item of items) {
    const current = chosen.get(item.id);
    if (!current) {
      chosen.set(item.id, item);
      continue;
    }
    const currentIsFuture = current.endDate >= today;
    const itemIsFuture = item.endDate >= today;
    // já há uma ocorrência futura: fica a mais próxima; senão, a mais recente
    if (currentIsFuture ? itemIsFuture && item.date < current.date : itemIsFuture || item.date > current.date) chosen.set(item.id, item);
  }
  return items.filter((item) => chosen.get(item.id) === item);
}

/** Próximos compromissos ligados a um cliente (uma linha por compromisso; séries recolhidas). */
export async function listClientUpcomingEvents(viewer: AgendaViewer, clientId: number, today: ISODate, limit = 10): Promise<AgendaItem[]> {
  const items = await listRelatedAgenda(viewer, today, addDays(today, RELATED_AHEAD_DAYS), { clientId });
  return collapseSeries(items, today).slice(0, limit);
}

/**
 * Compromissos de um projeto, do último ano ao próximo (uma linha por compromisso; cancelados incluídos, com o
 * status). Primeiro os que ainda vêm (o mais próximo antes), depois os que já passaram (o mais recente antes).
 */
export async function listProjectEvents(viewer: AgendaViewer, projectId: number, today: ISODate, limit = 50): Promise<AgendaItem[]> {
  const items = await listRelatedAgenda(viewer, addDays(today, -RELATED_BACK_DAYS), addDays(today, RELATED_AHEAD_DAYS), { projectId }, { includeCancelled: true });
  const collapsed = collapseSeries(items, today);
  const upcoming = collapsed.filter((item) => item.endDate >= today);
  const past = collapsed.filter((item) => item.endDate < today).reverse();
  return [...upcoming, ...past].slice(0, limit);
}

/** Categorias de produção (gravações, sessões, eventos, casamentos — as que têm "planejamento de gravação"). */
export async function productionCategoryIds(): Promise<number[]> {
  const categories = await listCategories({ includeInactive: true });
  return categories.filter((category) => category.isProduction).map((category) => category.id);
}

// ------------------------------------------------- registros (sem expandir séries)
/** `getEventView` pede um dia para escolher a ocorrência de uma série; aqui só interessa o registro. */
const ANY_DAY: ISODate = "2000-01-01";

/**
 * Os compromissos que casam com `where`, UM POR REGISTRO (séries não são expandidas), cada um pela porta da
 * agenda (alcance + privacidade): quem não participa de um particular recebe o `MaskedEvent` (só horário e dono).
 * `unreachable` conta os que a agenda não entrega a esta pessoa de jeito nenhum (fora do alcance dela).
 *
 * Uso: contagens e exportações, onde não há janela de datas. A tabela é lida só para achar os ids; os campos vêm
 * de `getEventView` (uma consulta por compromisso — os volumes aqui são pequenos: os compromissos de UM cliente,
 * ou só os particulares na exportação completa).
 */
export async function listVisibleEventRecords(viewer: AgendaViewer, where: SQL | undefined): Promise<{ events: VisibleEvent[]; unreachable: number }> {
  const rows = await db.select({ id: agendaEvents.id }).from(agendaEvents).where(where).orderBy(agendaEvents.date, agendaEvents.id);
  const events: VisibleEvent[] = [];
  for (const row of rows) {
    const view = await getEventView(viewer, row.id, null, ANY_DAY);
    if (view) events.push(view.event);
  }
  return { events, unreachable: rows.length - events.length };
}

export type ClientEventRecords = {
  /** Os que esta pessoa vê por inteiro. */
  visible: FullEvent[];
  /** Particulares de outras pessoas: só horário e dono. */
  masked: MaskedEvent[];
  /** Fora do alcance desta pessoa na agenda (nem "Ocupado"). */
  unreachable: number;
};

/** Compromissos ligados a um cliente, como a agenda os entrega a esta pessoa. */
export async function listClientEventRecords(viewer: AgendaViewer, clientId: number): Promise<ClientEventRecords> {
  const { events, unreachable } = await listVisibleEventRecords(viewer, eq(agendaEvents.clientId, clientId));
  return {
    visible: events.filter((event): event is FullEvent => !event.masked),
    masked: events.filter((event): event is MaskedEvent => event.masked),
    unreachable,
  };
}

/** Todos os compromissos PARTICULARES que a agenda entrega a esta pessoa, inteiros ou mascarados (exportação completa). */
export async function listPrivateEventRecords(viewer: AgendaViewer): Promise<VisibleEvent[]> {
  return (await listVisibleEventRecords(viewer, eq(agendaEvents.visibility, "particular"))).events;
}

// ------------------------------------------------------------------- anexos
/**
 * Esta pessoa pode abrir um arquivo anexado a estes compromissos? Só se a agenda lhe entrega algum deles POR
 * INTEIRO (anexo de particular de outra pessoa não abre; fora do alcance dela, também não).
 * Quem chama (`src/server/access/media.ts`) confere antes a permissão "ver" da Agenda no módulo inteiro.
 */
export async function seesSomeEventInFull(viewer: AgendaViewer, eventIds: readonly number[]): Promise<boolean> {
  for (const id of eventIds) {
    const view = await getEventView(viewer, id, null, ANY_DAY);
    if (view && !view.event.masked) return true;
  }
  return false;
}
