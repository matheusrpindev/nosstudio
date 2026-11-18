/**
 * Filtros da lista/funil/exportação lidos da URL (entrada do usuário: tudo validado contra os enums).
 * Compartilhado entre a página e o Route Handler de exportação para os dois "enxergarem" o mesmo filtro.
 */
import { firstParam, paramId, paramOneOf, paramText, type SearchParamValue } from "@/components/ui/search-params";
import { CLIENT_STATUSES, CONTACT_SOURCES, SERVICE_INTERESTS } from "@/lib/domain";
import type { ClientFilters } from "@/server/clients/admin";

export function clientFiltersFromParams(params: Record<string, SearchParamValue>): Omit<ClientFilters, "page"> {
  return {
    status: paramOneOf(CLIENT_STATUSES, params.status),
    owner: paramId(params.responsavel),
    service: paramOneOf(SERVICE_INTERESTS, params.servico),
    source: paramOneOf(CONTACT_SOURCES, params.origem),
    q: paramText(params.q),
  };
}

/** Querystring dos filtros ativos (para os links "Lista | Funil" e "Exportar CSV" manterem a seleção). */
export function clientFiltersToQuery(filters: Omit<ClientFilters, "page">, extra: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  if (filters.owner) query.set("responsavel", String(filters.owner));
  if (filters.service) query.set("servico", filters.service);
  if (filters.source) query.set("origem", filters.source);
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const isFunnelView = (value: SearchParamValue) => firstParam(value) === "funil";
