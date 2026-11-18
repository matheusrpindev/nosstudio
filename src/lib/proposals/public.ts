/**
 * Visão PÚBLICA de uma proposta: o único objeto que pode ir para o PDF ou sair do painel.
 *
 * Regra de segurança fundamental do projeto: custos de prestadores, aluguel de equipamentos, margem,
 * pró-labore, notas internas e descontos ainda não aprovados JAMAIS aparecem para o cliente.
 * Por isso este arquivo monta o objeto campo a campo (lista de permissão) — nunca use spread de linhas
 * do banco aqui. Os testes em public.test.ts falham se algum valor interno escapar.
 */
import { formatDate } from "@/lib/dates";
import { PROPOSAL_MODALITY_LABELS, type EntryMode, type ProposalItemKind, type ProposalModality } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import { clientNumbers, lineTotalCents, paymentsDifferenceCents } from "./calc";

/** Dados de entrada: o que o painel carrega do banco (inclui campos internos, que serão descartados). */
export type ProposalSource = {
  proposal: {
    number: string;
    version: number;
    modality: ProposalModality;
    title: string;
    clientDisplayName: string;
    contactName: string;
    eventDate: string | null;
    eventLocation: string;
    validUntil: string | null;
    intro: string;
    scheduleText: string;
    exclusions: string;
    paymentNotes: string;
    conditions: string;
    discountCents: number;
    discountLabel: string;
    discountApproved: boolean;
    showItemPrices: boolean;
    entryMode: EntryMode;
    entryPercent: number;
    entryCents: number;
    // os campos abaixo existem na linha do banco, mas NÃO são lidos aqui:
    internalNotes?: unknown;
    overheadCents?: unknown;
    taxPercent?: unknown;
    targetMarginPercent?: unknown;
  };
  items: {
    kind: ProposalItemKind;
    title: string;
    description: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    sortOrder: number;
  }[];
  payments: { label: string; dueDate: string | null; dueLabel: string; amountCents: number; sortOrder: number }[];
  /** Nome do cliente no cadastro (usado se `clientDisplayName` estiver vazio). */
  clientName: string;
  /** Responsável comercial. */
  ownerName: string;
  /** Data de emissão (YYYY-MM-DD). */
  issuedOn: string;
  company: {
    brandName: string;
    tagline: string;
    descriptor: string;
    aboutText: string;
    whatsapp: string;
    email: string;
    instagram: string;
    siteUrl: string;
  };
};

export type PublicProposalItem = {
  title: string;
  description: string;
  /** Ex.: "2 profissionais", "8 horas". Vazio quando a quantidade é 1 e não há unidade. */
  quantityLabel: string;
  /** Valor da linha — só quando a proposta exibe preços por item (opcionais sempre exibem, se tiverem valor). */
  totalCents: number | null;
};

export type PublicProposal = {
  number: string;
  version: number;
  modalityLabel: string;
  title: string;
  clientName: string;
  contactName: string;
  eventDate: string | null;
  eventLocation: string;
  validUntil: string | null;
  issuedOn: string;
  ownerName: string;
  intro: string;
  scheduleText: string;
  exclusions: string;
  paymentNotes: string;
  conditions: string;
  items: PublicProposalItem[];
  optionals: PublicProposalItem[];
  /** Subtotal antes do desconto — só vem preenchido quando há desconto aprovado. */
  subtotalCents: number | null;
  discount: { label: string; cents: number } | null;
  totalCents: number;
  entry: { cents: number; percent: number } | null;
  balanceCents: number;
  payments: { label: string; dueText: string; amountCents: number }[];
  company: ProposalSource["company"];
};

function quantityLabel(quantity: number, unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed && quantity === 1) return "";
  return `${formatNumber(quantity)}${trimmed ? ` ${trimmed}` : ""}`;
}

export function toPublicProposal(source: ProposalSource): PublicProposal {
  const { proposal } = source;
  const numbers = clientNumbers({
    items: source.items,
    discountCents: proposal.discountCents,
    discountApproved: proposal.discountApproved,
    entryMode: proposal.entryMode,
    entryPercent: proposal.entryPercent,
    entryCents: proposal.entryCents,
  });
  const ordered = [...source.items].sort((a, b) => a.sortOrder - b.sortOrder);
  // Desconto ainda NÃO aprovado + parcelas que não fecham com o total público: o plano foi calculado com o
  // desconto (ou está desatualizado) e a diferença entregaria o valor que não pode sair do painel. Nesse caso
  // as parcelas ficam de fora — o PDF sai só com o texto das condições de pagamento — até o plano fechar.
  const discountPending = proposal.discountCents > 0 && !proposal.discountApproved;
  const hidePayments = discountPending && paymentsDifferenceCents(source.payments, numbers.totalCents) !== 0;
  const toItem = (item: ProposalSource["items"][number], showPrice: boolean): PublicProposalItem => {
    const total = lineTotalCents(item);
    return {
      title: item.title,
      description: item.description,
      quantityLabel: quantityLabel(item.quantity, item.unit),
      totalCents: showPrice && total > 0 ? total : null,
    };
  };

  return {
    number: proposal.number,
    version: proposal.version,
    modalityLabel: PROPOSAL_MODALITY_LABELS[proposal.modality],
    title: proposal.title,
    clientName: proposal.clientDisplayName.trim() || source.clientName,
    contactName: proposal.contactName,
    eventDate: proposal.eventDate,
    eventLocation: proposal.eventLocation,
    validUntil: proposal.validUntil,
    issuedOn: source.issuedOn,
    ownerName: source.ownerName,
    intro: proposal.intro,
    scheduleText: proposal.scheduleText,
    exclusions: proposal.exclusions,
    paymentNotes: proposal.paymentNotes,
    conditions: proposal.conditions,
    items: ordered.filter((item) => item.kind === "incluso").map((item) => toItem(item, proposal.showItemPrices)),
    optionals: ordered.filter((item) => item.kind === "opcional").map((item) => toItem(item, true)),
    subtotalCents: numbers.discountCents > 0 ? numbers.itemsTotalCents : null,
    discount:
      numbers.discountCents > 0
        ? { label: proposal.discountLabel.trim() || "Desconto", cents: numbers.discountCents }
        : null,
    totalCents: numbers.totalCents,
    entry: numbers.entryCents > 0 ? { cents: numbers.entryCents, percent: numbers.entryPercent } : null,
    balanceCents: numbers.balanceCents,
    payments: (hidePayments ? [] : [...source.payments])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((payment) => ({
        label: payment.label,
        dueText: payment.dueDate ? formatDate(payment.dueDate) : payment.dueLabel,
        amountCents: payment.amountCents,
      })),
    company: {
      brandName: source.company.brandName,
      tagline: source.company.tagline,
      descriptor: source.company.descriptor,
      aboutText: source.company.aboutText,
      whatsapp: source.company.whatsapp,
      email: source.company.email,
      instagram: source.company.instagram,
      siteUrl: source.company.siteUrl,
    },
  };
}

/** Nome de arquivo do PDF: `NOS-Studio-Proposta-2026-007-v2-Ana-e-Bruno.pdf`. */
export function proposalFileName(proposal: Pick<PublicProposal, "number" | "version" | "clientName">): string {
  const client = proposal.clientName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "e")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const version = proposal.version > 1 ? `-v${proposal.version}` : "";
  return `NOS-Studio-Proposta-${proposal.number}${version}${client ? `-${client}` : ""}.pdf`;
}
