/**
 * Filtros da lista de lançamentos: leitura segura da URL (entrada do usuário) e montagem de links.
 * Usado pela página `/painel/financeiro` e pelo CSV (`/painel/financeiro/exportar`) — os dois respeitam os mesmos filtros.
 * Arquivo puro (sem banco).
 */
import { isISODate, startOfMonth, endOfMonth, type ISODate } from "@/lib/dates";
import { FINANCE_CATEGORIES, FINANCE_TYPES, type FinanceCategory, type FinanceType } from "@/lib/domain";
import type { EntryStatus } from "./summary";

export const ENTRY_SITUATIONS = ["previsto", "realizado", "vencido"] as const satisfies readonly EntryStatus[];

type Raw = Record<string, string | string[] | undefined>;

export type FinanceFilters = {
  /** Mês em foco (`YYYY-MM-01`): resumo, gráfico e, por padrão, a lista. */
  month: ISODate;
  type?: FinanceType;
  category?: FinanceCategory;
  situation?: EntryStatus;
  clientId?: number;
  projectId?: number;
  /** Só os lançamentos ligados a esta proposta (vem do cartão "Financeiro" do orçamento). */
  proposalId?: number;
  /** Período livre (data de referência: pagamento, ou vencimento se em aberto). */
  from?: ISODate;
  to?: ISODate;
  q?: string;
  page: number;
};

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

function oneOf<T extends string>(list: readonly T[], value: string | string[] | undefined): T | undefined {
  const v = first(value);
  return v && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

function positiveId(value: string | string[] | undefined): number | undefined {
  const v = first(value);
  if (!v || !/^\d{1,9}$/.test(v)) return undefined;
  const n = Number(v);
  return n > 0 ? n : undefined;
}

function dateParam(value: string | string[] | undefined): ISODate | undefined {
  const v = first(value);
  return v && isISODate(v) ? v : undefined;
}

/** Lê `?mes=YYYY-MM` (mês de hoje se ausente/inválido). */
export function parseMonth(value: string | string[] | undefined, today: ISODate): ISODate {
  const raw = first(value);
  if (raw && /^\d{4}-\d{2}$/.test(raw) && isISODate(`${raw}-01`)) {
    const year = Number(raw.slice(0, 4));
    if (year >= 2000 && year <= 2100) return `${raw}-01`;
  }
  return startOfMonth(today);
}

export function parseFinanceFilters(raw: Raw, today: ISODate): FinanceFilters {
  const q = first(raw.q)?.trim().slice(0, 80);
  const page = Number(first(raw.pagina));
  return {
    month: parseMonth(raw.mes, today),
    type: oneOf(FINANCE_TYPES, raw.tipo),
    category: oneOf(FINANCE_CATEGORIES, raw.categoria),
    situation: oneOf(ENTRY_SITUATIONS, raw.situacao),
    clientId: positiveId(raw.cliente),
    projectId: positiveId(raw.projeto),
    proposalId: positiveId(raw.proposta),
    from: dateParam(raw.de),
    to: dateParam(raw.ate),
    q: q || undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export type Scope = { kind: "month" | "range" | "all"; from?: ISODate; to?: ISODate };

/**
 * Período que a lista cobre:
 * - datas informadas ("de"/"até") → intervalo livre;
 * - filtro por cliente, projeto, proposta ou "vencido" → todo o histórico (esses recortes atravessam meses);
 * - senão → o mês em foco.
 */
export function resolveScope(filters: FinanceFilters): Scope {
  if (filters.from || filters.to) return { kind: "range", from: filters.from, to: filters.to };
  if (filters.clientId || filters.projectId || filters.proposalId || filters.situation === "vencido") return { kind: "all" };
  return { kind: "month", from: startOfMonth(filters.month), to: endOfMonth(filters.month) };
}

/** Querystring (sem `?`) com os filtros atuais, aplicando `overrides` (`null` remove o parâmetro). */
export function filtersToQuery(filters: FinanceFilters, overrides: Partial<Record<"mes" | "pagina", string | null>> = {}): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined | null) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  };
  set("mes", filters.month.slice(0, 7));
  set("tipo", filters.type);
  set("categoria", filters.category);
  set("situacao", filters.situation);
  set("cliente", filters.clientId);
  set("projeto", filters.projectId);
  set("proposta", filters.proposalId);
  set("de", filters.from);
  set("ate", filters.to);
  set("q", filters.q);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else if (value !== undefined) params.set(key, value);
  }
  return params.toString();
}
