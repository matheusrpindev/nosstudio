/**
 * Cálculo de propostas comerciais — lógica pura, coberta por testes (calc.test.ts).
 *
 * Duas visões, deliberadamente separadas:
 *  - `clientNumbers`  → o que o CLIENTE vê (itens, desconto aprovado, total, sinal, saldo);
 *  - `internalNumbers` → custos, tributos, margem e markup — SOMENTE painel.
 * O PDF e qualquer saída externa usam apenas `toPublicProposal()` (public.ts).
 */
import type { EntryMode, ProposalItemKind } from "@/lib/domain";

export type CalcItem = { kind: ProposalItemKind; quantity: number; unitPriceCents: number };
export type CalcCost = { amountCents: number };

export type PriceInput = {
  items: CalcItem[];
  discountCents: number;
  /** Desconto só vale para o cliente depois de aprovado pelos sócios. */
  discountApproved: boolean;
  entryMode: EntryMode;
  entryPercent: number;
  entryCents: number;
};

export type ClientNumbers = {
  /** Soma dos itens inclusos. */
  itemsTotalCents: number;
  /** Soma dos opcionais (não entram no total). */
  optionalsTotalCents: number;
  /** Desconto que o cliente vê (0 enquanto não aprovado). */
  discountCents: number;
  /** Preço final ao cliente. */
  totalCents: number;
  /** Sinal / entrada. */
  entryCents: number;
  /** Percentual do sinal sobre o total (informativo quando o sinal é em valor). */
  entryPercent: number;
  /** Total menos o sinal. */
  balanceCents: number;
};

const clampCents = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

export function lineTotalCents(item: Pick<CalcItem, "quantity" | "unitPriceCents">): number {
  const quantity = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
  return Math.round(quantity * clampCents(item.unitPriceCents));
}

export function clientNumbers(input: PriceInput): ClientNumbers {
  const sum = (kind: ProposalItemKind) =>
    input.items.filter((item) => item.kind === kind).reduce((total, item) => total + lineTotalCents(item), 0);
  const itemsTotalCents = sum("incluso");
  const optionalsTotalCents = sum("opcional");
  const discountCents = input.discountApproved ? Math.min(clampCents(input.discountCents), itemsTotalCents) : 0;
  const totalCents = itemsTotalCents - discountCents;

  const percent = Math.min(100, Math.max(0, Number.isFinite(input.entryPercent) ? input.entryPercent : 0));
  const entryCents =
    input.entryMode === "percentual"
      ? Math.round((totalCents * percent) / 100)
      : Math.min(clampCents(input.entryCents), totalCents);
  const entryPercent =
    input.entryMode === "percentual" ? percent : totalCents > 0 ? Math.round((entryCents / totalCents) * 1000) / 10 : 0;

  return {
    itemsTotalCents,
    optionalsTotalCents,
    discountCents,
    totalCents,
    entryCents,
    entryPercent,
    balanceCents: totalCents - entryCents,
  };
}

export type InternalInput = {
  /** Preço final ao cliente (de `clientNumbers`). */
  totalCents: number;
  /** Custos diretos de execução (equipe, locação, deslocamento, pós-produção…). */
  costs: CalcCost[];
  /** Rateio de despesas fixas atribuído à proposta. */
  overheadCents: number;
  /** Tributos estimados, em % do preço. */
  taxPercent: number;
  /** Margem-alvo, em % do preço. */
  targetMarginPercent: number;
};

export type InternalNumbers = {
  /** Custo direto = soma dos itens de execução. */
  directCostCents: number;
  overheadCents: number;
  /** Tributos estimados = preço × %. */
  taxCents: number;
  /** Custo total = custo direto + rateio de despesas + tributos estimados. */
  totalCostCents: number;
  /** Resultado estimado = preço − custo total. */
  profitCents: number;
  /** Margem de contribuição = (preço − custos variáveis [diretos + tributos]) ÷ preço. */
  contributionMarginPercent: number | null;
  /** Margem líquida estimada = resultado ÷ preço. */
  netMarginPercent: number | null;
  /** Markup = resultado ÷ custo total (quanto o preço está ACIMA do custo — não confundir com margem). */
  markupPercent: number | null;
  targetMarginPercent: number;
  /** Margem líquida abaixo da meta? (`null` quando não há meta ou preço) */
  belowTarget: boolean | null;
  /** Preço que atingiria a margem-alvo com os custos atuais (`null` se a meta + tributos ≥ 100%). */
  suggestedPriceCents: number | null;
};

const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

export function internalNumbers(input: InternalInput): InternalNumbers {
  const totalCents = clampCents(input.totalCents);
  const directCostCents = input.costs.reduce((total, cost) => total + clampCents(cost.amountCents), 0);
  const overheadCents = clampCents(input.overheadCents);
  // percentuais em pontos-base (inteiros) para a aritmética não sofrer com ponto flutuante
  const taxBp = Math.round(Math.min(100, Math.max(0, input.taxPercent || 0)) * 100);
  const targetBp = Math.round(Math.min(100, Math.max(0, input.targetMarginPercent || 0)) * 100);
  const taxCents = Math.round((totalCents * taxBp) / 10_000);
  const totalCostCents = directCostCents + overheadCents + taxCents;
  const profitCents = totalCents - totalCostCents;
  const netMarginPercent = percentOf(profitCents, totalCents);

  // preço p tal que (p − diretos − rateio − p·tributos) ÷ p = meta  →  p = (diretos + rateio) ÷ (1 − tributos − meta)
  const denominatorBp = 10_000 - taxBp - targetBp;
  const suggestedPriceCents =
    targetBp > 0 && denominatorBp > 0 ? Math.ceil(((directCostCents + overheadCents) * 10_000) / denominatorBp) : null;

  return {
    directCostCents,
    overheadCents,
    taxCents,
    totalCostCents,
    profitCents,
    contributionMarginPercent: percentOf(totalCents - directCostCents - taxCents, totalCents),
    netMarginPercent,
    markupPercent: percentOf(profitCents, totalCostCents),
    targetMarginPercent: targetBp / 100,
    belowTarget: targetBp > 0 && netMarginPercent !== null ? netMarginPercent < targetBp / 100 : null,
    suggestedPriceCents,
  };
}

export type PaymentLine = { label: string; amountCents: number };

/**
 * Sugere o plano de pagamento: entrada + saldo dividido em `installments` parcelas iguais
 * (os centavos que sobram vão para a última, para a soma fechar exatamente com o total).
 */
export function suggestPayments(numbers: Pick<ClientNumbers, "totalCents" | "entryCents" | "entryPercent">, installments: number): PaymentLine[] {
  const lines: PaymentLine[] = [];
  const entry = Math.min(clampCents(numbers.entryCents), numbers.totalCents);
  const balance = numbers.totalCents - entry;
  if (entry > 0) {
    const percent = numbers.entryPercent > 0 ? ` (${numbers.entryPercent.toLocaleString("pt-BR")}%)` : "";
    lines.push({ label: `Entrada${percent}`, amountCents: entry });
  }
  const count = Math.max(1, Math.min(24, Math.floor(installments) || 1));
  if (balance > 0) {
    if (count === 1) {
      lines.push({ label: entry > 0 ? "Saldo restante" : "Pagamento único", amountCents: balance });
    } else {
      const base = Math.floor(balance / count);
      for (let i = 1; i <= count; i++) {
        lines.push({ label: `Parcela ${i} de ${count}`, amountCents: i === count ? balance - base * (count - 1) : base });
      }
    }
  }
  return lines;
}

/** Diferença entre o plano de pagamento e o total (0 = fecha certinho). Positivo = sobra; negativo = falta. */
export function paymentsDifferenceCents(payments: { amountCents: number }[], totalCents: number): number {
  return payments.reduce((total, payment) => total + clampCents(payment.amountCents), 0) - totalCents;
}
