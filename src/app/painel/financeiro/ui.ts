/**
 * Apresentação do financeiro compartilhada entre as telas do módulo.
 * Rótulos de tipo/categoria/método vêm de `src/lib/domain.ts`; aqui ficam a situação do lançamento (texto + tom).
 */
import type { BadgeTone } from "@/components/ui/badge";
import type { FinanceType } from "@/lib/domain";
import type { EntryStatus } from "@/server/finance/summary";

/** "Recebido", "A pagar"… — o texto muda conforme seja receita ou despesa. */
export const ENTRY_STATUS_LABELS: Record<FinanceType, Record<EntryStatus, string>> = {
  receita: { realizado: "Recebido", vencido: "Vencido", previsto: "A receber" },
  despesa: { realizado: "Pago", vencido: "Vencido", previsto: "A pagar" },
};

export const ENTRY_STATUS_TONES: Record<EntryStatus, BadgeTone> = {
  realizado: "sucesso",
  vencido: "perigo",
  previsto: "neutral",
};

/** Opções do filtro "Situação" (os rótulos explicam o que cada um mostra). */
export const SITUATION_FILTER_LABELS: Record<EntryStatus, string> = {
  previsto: "Previsto (em aberto, no prazo)",
  realizado: "Realizado (recebido/pago)",
  vencido: "Vencido (em aberto, atrasado)",
};
