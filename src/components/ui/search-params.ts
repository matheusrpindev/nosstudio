/**
 * Leitura segura de `searchParams` nas páginas de lista (a URL é entrada do usuário).
 * Arquivo puro: funciona em Server e Client Components.
 *
 *   const sp = await searchParams;
 *   const status = paramOneOf(LEAD_STATUSES, sp.status);   // LeadStatus | undefined
 *   const q = paramText(sp.q);                              // string | undefined
 *   const page = parsePage(sp.pagina);                      // inteiro ≥ 1
 */
export type SearchParamValue = string | string[] | undefined;
export type PageSearchParams = Promise<Record<string, SearchParamValue>>;

/** Primeiro valor do parâmetro (ignora repetições). */
export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Texto livre (busca): aparado, limitado e `undefined` quando vazio. */
export function paramText(value: SearchParamValue, max = 100): string | undefined {
  const text = firstParam(value)?.trim().slice(0, max);
  return text || undefined;
}

/** Só devolve o valor se ele existir na lista (enums de `src/lib/domain.ts`). */
export function paramOneOf<T extends string>(list: readonly T[], value: SearchParamValue): T | undefined {
  const candidate = firstParam(value);
  return list.find((item) => item === candidate);
}

/** Id numérico (ex.: `?cliente=12`). */
export function paramId(value: SearchParamValue): number | undefined {
  const n = Number(firstParam(value));
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** `?pagina=` → inteiro ≥ 1. */
export function parsePage(value: SearchParamValue): number {
  return paramId(value) ?? 1;
}
