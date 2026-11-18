/**
 * Apresentação do módulo de Conteúdo compartilhada entre as telas. Os RÓTULOS vêm de `src/lib/domain.ts`;
 * aqui ficam só as cores (decisão visual do módulo) e a leitura dos filtros da URL.
 */
import type { BadgeTone } from "@/components/ui/badge";
import type { CalendarTone } from "@/components/ui/month-calendar";
import { firstParam, paramId, paramOneOf, paramText, type SearchParamValue } from "@/components/ui/search-params";
import { CONTENT_FORMATS, CONTENT_NETWORKS, CONTENT_STATUSES, type ApprovalStatus, type ContentStatus } from "@/lib/domain";
import type { ContentFilters } from "@/server/content/admin";
import type { Option } from "@/server/options";

export const CONTENT_STATUS_TONES: Record<ContentStatus, BadgeTone> = {
  ideia: "neutral",
  roteiro: "roxo",
  gravacao: "lima",
  edicao: "alerta",
  aprovacao: "perigo",
  publicado: "sucesso",
};

export const APPROVAL_TONES: Record<ApprovalStatus, BadgeTone> = {
  pendente: "neutral",
  aprovado: "sucesso",
  ajustes: "alerta",
};

export const CALENDAR_STATUS_TONES: Record<ContentStatus, CalendarTone> = CONTENT_STATUS_TONES;

/** Gravações e prazos de edição: chip neutro com marca no texto (não depende só da cor). */
export const RECORD_MARK = "●";
export const EDIT_MARK = "✎";

export const VIEWS = ["calendario", "quadro", "lista"] as const;
export type ContentView = (typeof VIEWS)[number];
export const VIEW_LABELS: Record<ContentView, string> = { calendario: "Calendário", quadro: "Quadro", lista: "Lista e ideias" };

export const NOS_ACCOUNT_LABEL = "NÓS Studio (próprio)";

/** Opções do filtro "Conta": a NÓS e cada cliente. */
export function accountOptions(clients: Option[]): { value: string | number; label: string }[] {
  return [{ value: "nos", label: NOS_ACCOUNT_LABEL }, ...clients];
}

export type ParsedQuery = {
  view: ContentView;
  filters: ContentFilters;
  page: number;
  /** Os filtros como parâmetros de URL (para montar links que os preservam). */
  query: URLSearchParams;
};

/** A URL é entrada do usuário: só passa o que existe nos enums, nos clientes e nos responsáveis. */
export function parseContentQuery(params: Record<string, SearchParamValue>, clients: Option[], users: Option[]): ParsedQuery {
  const view = paramOneOf(VIEWS, params.vista) ?? "calendario";
  const contaRaw = firstParam(params.conta);
  const clientId = paramId(params.conta);
  const account: ContentFilters["account"] = contaRaw === "nos" ? "nos" : clientId && clients.some((c) => c.value === clientId) ? clientId : undefined;
  const ownerId = paramId(params.responsavel);
  const filters: ContentFilters = {
    account,
    network: paramOneOf(CONTENT_NETWORKS, params.rede),
    format: paramOneOf(CONTENT_FORMATS, params.formato),
    ownerId: users.some((u) => u.value === ownerId) ? ownerId : undefined,
    status: view === "quadro" ? undefined : paramOneOf(CONTENT_STATUSES, params.status),
    undated: view === "lista" && firstParam(params.data) === "sem" ? true : undefined,
    q: paramText(params.q),
  };
  const query = new URLSearchParams();
  if (account !== undefined) query.set("conta", String(account));
  if (filters.network) query.set("rede", filters.network);
  if (filters.format) query.set("formato", filters.format);
  if (filters.ownerId) query.set("responsavel", String(filters.ownerId));
  if (filters.status) query.set("status", filters.status);
  if (filters.undated) query.set("data", "sem");
  if (filters.q) query.set("q", filters.q);
  return { view, filters, page: paramId(params.pagina) ?? 1, query };
}

