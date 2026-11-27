/**
 * Contador público de visitas ("Cada visita é o começo de uma nova história."): textos e regra de exibição.
 * Arquivo puro — o número vem de `getPublicVisitCount()` (src/server/metrics/public.ts).
 */
import { formatMonth, type ISODate } from "@/lib/dates";

export type VisitCounterData = {
  /** Total de visitas contadas desde `since`. */
  total: number;
  /** Primeiro dia com medição. `null` = nada contado ainda. */
  since: ISODate | null;
};

export type VisitCounterSettings = { enabled: boolean; minimum: string; phrase: string; label: string };

/** Mínimo configurado no painel (texto com dígitos; vazio = sem mínimo). */
export function counterMinimum(raw: string): number {
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

const integer = new Intl.NumberFormat("pt-BR");

/**
 * O que o site mostra — ou `null` quando o contador não deve aparecer: desligado, sem legenda (o número precisa
 * dizer o que conta), sem nenhuma visita medida ou abaixo do mínimo escolhido pelos sócios.
 * `{{inicio}}` na legenda vira o mês em que a contagem começou ("novembro de 2026").
 */
export function visitCounterView(settings: VisitCounterSettings, data: VisitCounterData): { phrase: string; value: string; label: string } | null {
  const label = settings.label.trim();
  if (!settings.enabled || !label || !data.since || data.total <= 0) return null;
  if (data.total < counterMinimum(settings.minimum)) return null;
  return {
    phrase: settings.phrase.trim(),
    value: integer.format(data.total),
    label: label.replaceAll("{{inicio}}", formatMonth(data.since)),
  };
}
