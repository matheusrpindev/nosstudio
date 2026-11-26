/**
 * Lógica pura do módulo de Configurações (sem banco, sem servidor) — testada em `logic.test.ts`.
 */
import { randomBytes } from "node:crypto";

// ------------------------------------------------------------- senha temporária
/** Letras e números sem caracteres ambíguos (sem i, l, o, 0, 1) — fácil de ler e ditar. */
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Senha temporária aleatória: 4 blocos de 4 caracteres (`abcd-efgh-jkmn-pqrs`), 16 caracteres sorteados com
 * `crypto`. Sorteio por rejeição, sem viés de módulo. Sempre tem letras e números (cumpre `passwordProblem`).
 */
export function generateTemporaryPassword(): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  for (;;) {
    const chars: string[] = [];
    while (chars.length < 16) {
      for (const byte of randomBytes(32)) {
        if (byte < limit && chars.length < 16) chars.push(PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
      }
    }
    const raw = chars.join("");
    if (/[a-z]/.test(raw) && /\d/.test(raw)) return [0, 4, 8, 12].map((i) => raw.slice(i, i + 4)).join("-");
  }
}

// ------------------------------------------------------------------------- CSV
/**
 * Uma célula de CSV. Aspas dobradas quando preciso; valores que começam com `= + - @` (ou tab/CR) ganham um
 * apóstrofo na frente para a planilha não executá-los como fórmula (CSV injection).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV no padrão do Excel em pt-BR: separador `;`, quebra CRLF e BOM UTF-8 no início. */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Centavos → "1234,56" (sem símbolo nem milhar: a planilha entende como número). */
export function centsToCsv(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  return `${negative ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

// -------------------------------------------------------------------- período
const MS_DAY = 86_400_000;

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUTC - Math.floor(instant / 1000) * 1000;
}

/** Instante (ms) em que o dia `YYYY-MM-DD` começa no fuso do estúdio (00:00 local). */
export function dayStartMs(iso: string, timeZone: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - zoneOffsetMs(guess, timeZone);
  result = guess - zoneOffsetMs(result, timeZone); // segunda passada: corrige viradas de horário de verão
  return result;
}

/** Instante (ms) em que o dia SEGUINTE começa — limite exclusivo do período "até". */
export function nextDayStartMs(iso: string, timeZone: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d) + MS_DAY).toISOString().slice(0, 10);
  return dayStartMs(next, timeZone);
}

// ------------------------------------------------------------- tabelas exportadas
/**
 * Tabelas que NUNCA saem na exportação: credenciais, sessões e controle de abuso — e a caixa de avisos de cada
 * pessoa (`notifications`) com o controle de entrega dos lembretes (`agenda_reminder_deliveries`): são estado
 * pessoal e derivado, e trariam por tabela o título, o local e os participantes de compromissos PARTICULARES da
 * agenda (o lembrete de um particular vai só para quem participa dele; a exportação não pode entregá-lo a outra
 * pessoa). Tabela nova com conteúdo pessoal: decida aqui antes de ela entrar sozinha na exportação
 * (`src/app/painel/config/dados/labels.test.ts` cobra a decisão).
 */
export const EXPORT_EXCLUDED_TABLES: ReadonlySet<string> = new Set([
  "sessions",
  "password_reset_tokens",
  "rate_limits",
  "user_invites",
  "notifications",
  "agenda_reminder_deliveries",
]);
/** Colunas que nunca saem, em qualquer tabela (nome no banco e na propriedade do Drizzle). */
export const EXPORT_EXCLUDED_COLUMNS: ReadonlySet<string> = new Set(["password_hash", "passwordHash", "token_hash", "tokenHash"]);

/** Remove das linhas qualquer coluna proibida (defesa extra, além de não selecioná-las). */
export function stripSecretColumns<T extends Record<string, unknown>>(row: T): Partial<T> {
  const clean: Partial<T> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!EXPORT_EXCLUDED_COLUMNS.has(key)) (clean as Record<string, unknown>)[key] = value;
  }
  return clean;
}
