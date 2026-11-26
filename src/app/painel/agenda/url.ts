/**
 * Estado da agenda na URL (puro: serve à página, aos links do servidor e aos filtros do cliente).
 *
 *   /painel/agenda?vista=semana&data=2026-11-26&agendas=1-7&categorias=4-5&camadas=prazos-financeira
 *                 &cliente=3&projeto=8&responsavel=2&q=café
 *
 * Ausente = padrão: todas as agendas, todas as categorias, camadas padrão (prazos + editorial).
 * `agendas=0` / `categorias=0` / `camadas=nenhuma` = nada marcado. Formato antigo `?mes=YYYY-MM` continua valendo.
 */
import { isISODate, type ISODate } from "@/lib/dates";
import { AGENDA_DEFAULT_LAYERS, AGENDA_LAYERS, AGENDA_VIEWS, type AgendaLayer, type AgendaView } from "@/lib/domain";

export const AGENDA_PATH = "/painel/agenda";
export const DEFAULT_VIEW: AgendaView = "semana";

export type AgendaState = {
  view: AgendaView;
  date: ISODate;
  /** `null` = todas. */
  calendars: number[] | null;
  categories: number[] | null;
  /** `null` = as camadas padrão. */
  layers: AgendaLayer[] | null;
  clientId: number | null;
  projectId: number | null;
  personId: number | null;
  q: string;
};

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function idList(value: string | undefined): number[] | null {
  if (value === undefined || value === "") return null;
  const ids = value
    .split("-")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)].slice(0, 60);
}

function oneId(value: string | undefined): number | null {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : null;
}

export function parseAgendaState(params: Params, today: ISODate): AgendaState {
  const month = first(params.mes);
  const legacyMonth = month && /^\d{4}-\d{2}$/.test(month) && isISODate(`${month}-01`) ? `${month}-01` : null;
  const rawDate = first(params.data);
  const rawView = first(params.vista);
  const view = AGENDA_VIEWS.find((item) => item === rawView) ?? (legacyMonth ? "mes" : DEFAULT_VIEW);
  const rawLayers = first(params.camadas);
  return {
    view,
    date: rawDate && isISODate(rawDate) ? rawDate : (legacyMonth ?? today),
    calendars: idList(first(params.agendas)),
    categories: idList(first(params.categorias)),
    layers: rawLayers === undefined ? null : AGENDA_LAYERS.filter((layer) => rawLayers.split("-").includes(layer)),
    clientId: oneId(first(params.cliente)),
    projectId: oneId(first(params.projeto)),
    personId: oneId(first(params.responsavel)),
    q: (first(params.q) ?? "").trim().slice(0, 100),
  };
}

export const activeLayers = (state: Pick<AgendaState, "layers">): readonly AgendaLayer[] => state.layers ?? AGENDA_DEFAULT_LAYERS;

/** Monta a URL da agenda. `today` omite a data quando ela é hoje (URL mais curta e "Hoje" de verdade). */
export function agendaHref(state: AgendaState, patch: Partial<AgendaState> = {}, today?: ISODate): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  if (next.view !== DEFAULT_VIEW) params.set("vista", next.view);
  if (next.date !== today) params.set("data", next.date);
  if (next.calendars) params.set("agendas", next.calendars.length ? next.calendars.join("-") : "0");
  if (next.categories) params.set("categorias", next.categories.length ? next.categories.join("-") : "0");
  if (next.layers) params.set("camadas", next.layers.length ? next.layers.join("-") : "nenhuma");
  if (next.clientId) params.set("cliente", String(next.clientId));
  if (next.projectId) params.set("projeto", String(next.projectId));
  if (next.personId) params.set("responsavel", String(next.personId));
  if (next.q) params.set("q", next.q);
  const query = params.toString();
  return query ? `${AGENDA_PATH}?${query}` : AGENDA_PATH;
}

/** Quantos filtros estão ligados (para o selo do botão "Filtros" no celular). */
export function activeFilterCount(state: AgendaState): number {
  return [state.calendars, state.categories, state.clientId, state.projectId, state.personId].filter((value) => value !== null).length;
}
