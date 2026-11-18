/**
 * Rascunho de proposta: o formato que o editor (cliente) mantém em memória e envia ao servidor em JSON.
 * Arquivo puro (sem banco): o editor usa os tipos e os cálculos ao vivo; a Server Action valida com
 * `proposalDraftSchema` e o servidor recalcula tudo antes de gravar (fonte da verdade).
 */
import { z } from "zod";
import { isISODate } from "@/lib/dates";
import { ENTRY_MODES, PROPOSAL_COST_CATEGORIES, PROPOSAL_ITEM_KINDS, PROPOSAL_MODALITIES, type ProposalModality } from "@/lib/domain";
import { clientNumbers, internalNumbers, paymentsDifferenceCents, type ClientNumbers, type InternalNumbers } from "@/lib/proposals/calc";

export const DRAFT_LIMITS = { items: 60, costs: 60, payments: 36, moneyCents: 99_999_999_99, quantity: 100_000 } as const;

const text = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`);
const cents = z
  .number({ error: "Informe um valor válido." })
  .int("Informe um valor válido.")
  .min(0, "O valor não pode ser negativo.")
  .max(DRAFT_LIMITS.moneyCents, "Valor alto demais.");
const percent = z.number({ error: "Informe um percentual." }).min(0, "Mínimo 0%.").max(100, "Máximo 100%.");
/** Data opcional: "" e null viram null. */
const optionalDate = z
  .union([z.string(), z.null()])
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || isISODate(value), "Data inválida.");
const optionalId = z
  .union([z.number(), z.null()])
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), "Opção inválida.");

const itemSchema = z.object({
  kind: z.enum(PROPOSAL_ITEM_KINDS),
  title: text(160).min(1, "Dê um título ao item."),
  description: text(1000),
  quantity: z.number({ error: "Informe a quantidade." }).min(0, "A quantidade não pode ser negativa.").max(DRAFT_LIMITS.quantity, "Quantidade alta demais."),
  unit: text(40),
  unitPriceCents: cents,
});

const costSchema = z.object({
  category: z.enum(PROPOSAL_COST_CATEGORIES),
  description: text(200),
  amountCents: cents,
});

const paymentSchema = z
  .object({
    label: text(120).min(1, "Dê um nome à parcela (ex.: Entrada)."),
    dueDate: optionalDate,
    dueLabel: text(120),
    amountCents: cents,
  })
  // vencimento é data OU texto livre: com data, o texto é descartado
  .transform((payment) => ({ ...payment, dueLabel: payment.dueDate ? "" : payment.dueLabel }));

export const proposalDraftSchema = z.object({
  templateName: text(120),
  modality: z.enum(PROPOSAL_MODALITIES, { error: "Selecione a modalidade." }),
  clientId: optionalId,
  clientDisplayName: text(160),
  contactName: text(160),
  ownerId: optionalId,
  title: text(160).min(1, "Informe o título da proposta."),
  eventDate: optionalDate,
  eventLocation: text(200),
  validUntil: optionalDate,

  intro: text(6000),
  scheduleText: text(6000),
  exclusions: text(6000),
  paymentNotes: text(6000),
  conditions: text(8000),

  items: z.array(itemSchema).max(DRAFT_LIMITS.items, `No máximo ${DRAFT_LIMITS.items} itens.`),
  discountCents: cents,
  discountLabel: text(120),
  discountApproved: z.boolean(),
  showItemPrices: z.boolean(),
  entryMode: z.enum(ENTRY_MODES),
  entryPercent: percent,
  entryCents: cents,
  payments: z.array(paymentSchema).max(DRAFT_LIMITS.payments, `No máximo ${DRAFT_LIMITS.payments} parcelas.`),

  // ---- cálculo interno (só painel)
  costs: z.array(costSchema).max(DRAFT_LIMITS.costs, `No máximo ${DRAFT_LIMITS.costs} custos.`),
  overheadCents: cents,
  taxPercent: percent,
  targetMarginPercent: percent,
  internalNotes: text(8000),
});

/** O que o editor mantém em memória (datas vazias como ""). */
export type ProposalDraft = z.input<typeof proposalDraftSchema>;
/** O rascunho já validado e normalizado. */
export type ValidProposalDraft = z.output<typeof proposalDraftSchema>;
export type DraftItem = ProposalDraft["items"][number];
export type DraftCost = ProposalDraft["costs"][number];
export type DraftPayment = ProposalDraft["payments"][number];

/** Linhas totalmente em branco (o usuário clicou em "adicionar" e não preencheu) são ignoradas ao salvar. */
export function dropBlankRows(draft: ProposalDraft): ProposalDraft {
  return {
    ...draft,
    items: draft.items.filter((item) => item.title.trim() || item.description.trim() || item.unit.trim() || item.unitPriceCents > 0),
    costs: draft.costs.filter((cost) => cost.description.trim() || cost.amountCents > 0),
    payments: draft.payments.filter((payment) => payment.label.trim() || payment.dueDate || payment.dueLabel.trim() || payment.amountCents > 0),
  };
}

export type DraftNumbers = {
  client: ClientNumbers;
  internal: InternalNumbers;
  /** Soma das parcelas − total (0 = fecha). */
  paymentsDifferenceCents: number;
  /** Desconto digitado mas ainda não aprovado (não entra no total nem no PDF). */
  pendingDiscountCents: number;
};

type NumbersInput = Pick<
  ProposalDraft,
  "items" | "discountCents" | "discountApproved" | "entryMode" | "entryPercent" | "entryCents" | "costs" | "overheadCents" | "taxPercent" | "targetMarginPercent" | "payments"
>;

/** Todos os números da proposta a partir do rascunho — mesma conta no navegador (ao vivo) e no servidor (ao salvar). */
export function draftNumbers(draft: NumbersInput): DraftNumbers {
  const client = clientNumbers({
    items: draft.items,
    discountCents: draft.discountCents,
    discountApproved: draft.discountApproved,
    entryMode: draft.entryMode,
    entryPercent: draft.entryPercent,
    entryCents: draft.entryCents,
  });
  const internal = internalNumbers({
    totalCents: client.totalCents,
    costs: draft.costs,
    overheadCents: draft.overheadCents,
    taxPercent: draft.taxPercent,
    targetMarginPercent: draft.targetMarginPercent,
  });
  return {
    client,
    internal,
    paymentsDifferenceCents: paymentsDifferenceCents(draft.payments, client.totalCents),
    pendingDiscountCents: !draft.discountApproved && draft.discountCents > 0 ? draft.discountCents : 0,
  };
}

/** Título sugerido para uma proposta nova sem modelo. */
export const DEFAULT_TITLES: Record<ProposalModality, string> = {
  mensal: "Plano mensal",
  diaria_evento: "Cobertura de evento",
  casamento: "Cobertura de casamento",
  personalizada: "Proposta personalizada",
};

/** Em qual etapa do editor mora cada campo (para abrir a aba certa quando o servidor acusa um erro). */
export const EDITOR_STEPS = ["dados", "escopo", "interno", "preco", "textos", "pdf"] as const;
export type EditorStep = (typeof EDITOR_STEPS)[number];

export function stepOfField(path: string): EditorStep {
  const field = path.split(".")[0];
  if (["items", "intro", "scheduleText", "exclusions"].includes(field)) return "escopo";
  if (["costs", "overheadCents", "taxPercent", "targetMarginPercent", "internalNotes"].includes(field)) return "interno";
  if (["discountCents", "discountLabel", "discountApproved", "showItemPrices", "entryMode", "entryPercent", "entryCents", "payments"].includes(field)) return "preco";
  if (["paymentNotes", "conditions"].includes(field)) return "textos";
  return "dados";
}
