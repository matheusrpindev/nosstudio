/**
 * CSV do financeiro (para abrir no Excel/Planilhas em português): separador ";", BOM UTF-8, valores no formato
 * brasileiro (`1.234,56`), datas `dd/mm/aaaa`. Arquivo puro, testado em `csv.test.ts`.
 */
import { formatDate, type ISODate } from "@/lib/dates";
import { FINANCE_CATEGORY_LABELS, FINANCE_TYPE_LABELS, PAYMENT_METHOD_LABELS, type FinanceCategory, type FinanceType, type PaymentMethod } from "@/lib/domain";
import { centsToInput } from "@/lib/format";
import { entryStatus } from "./summary";

export type CsvEntry = {
  type: FinanceType;
  category: FinanceCategory;
  description: string;
  amountCents: number;
  dueDate: ISODate;
  paidAt: ISODate | null;
  installmentLabel: string;
  method: PaymentMethod | null;
  supplier: string;
  clientName: string | null;
  projectTitle: string | null;
  notes: string;
};

const BOM = "﻿";
const SEPARATOR = ";";

/**
 * Escapa uma célula. Texto que começa com `=`, `+`, `-`, `@`, tab ou retorno de carro poderia virar fórmula na
 * planilha (injeção de CSV): ganha um apóstrofo na frente.
 */
export function csvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

const SITUATION_LABELS = {
  receita: { realizado: "Recebido", vencido: "Vencido (a receber)", previsto: "A receber" },
  despesa: { realizado: "Pago", vencido: "Vencido (a pagar)", previsto: "A pagar" },
} as const;

export const CSV_HEADERS = [
  "Tipo",
  "Categoria",
  "Descrição",
  "Cliente",
  "Projeto",
  "Fornecedor",
  "Parcela",
  "Vencimento",
  "Situação",
  "Previsto (R$)",
  "Realizado (R$)",
  "Data do pagamento/recebimento",
  "Método",
  "Observações",
] as const;

/** Monta o arquivo inteiro (com BOM). `today` define quem está vencido. */
export function buildFinanceCsv(entries: readonly CsvEntry[], today: ISODate): string {
  const lines: string[] = [CSV_HEADERS.map(csvCell).join(SEPARATOR)];
  for (const entry of entries) {
    const status = entryStatus(entry, today);
    const cells = [
      FINANCE_TYPE_LABELS[entry.type],
      FINANCE_CATEGORY_LABELS[entry.category],
      entry.description,
      entry.clientName ?? "",
      entry.projectTitle ?? "",
      entry.supplier,
      entry.installmentLabel,
      formatDate(entry.dueDate),
      SITUATION_LABELS[entry.type][status],
      centsToInput(entry.amountCents),
      centsToInput(entry.paidAt ? entry.amountCents : 0),
      entry.paidAt ? formatDate(entry.paidAt) : "",
      entry.method ? PAYMENT_METHOD_LABELS[entry.method] : "",
      entry.notes.replace(/\s*[\r\n]+\s*/g, " "),
    ];
    lines.push(cells.map(csvCell).join(SEPARATOR));
  }
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
