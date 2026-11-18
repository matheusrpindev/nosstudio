/**
 * CSV para o Excel/Planilhas em português: separador ";", quebra de linha CRLF e BOM UTF-8 (acentos corretos).
 * Lógica pura (sem servidor) — coberta por `csv.test.ts`.
 */
export const CSV_SEPARATOR = ";";
export const CSV_BOM = "﻿";

/**
 * Uma célula: aspas quando preciso e proteção contra "injeção de fórmula" (planilhas executam textos que começam
 * com = + - @): o texto ganha um apóstrofo na frente. Números de telefone/valores já saem formatados, sem sinal na frente.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Monta o arquivo inteiro: BOM + cabeçalho + linhas. */
export function buildCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR));
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}
