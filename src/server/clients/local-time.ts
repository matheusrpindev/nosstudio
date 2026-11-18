/**
 * Data e hora digitadas no formulário (`YYYY-MM-DDTHH:mm`, horário do estúdio) → instante (`Date`).
 * Lógica pura, coberta por `local-time.test.ts`. O fuso é o mesmo de `src/lib/dates.ts` (APP_TIMEZONE).
 */
const DEFAULT_TZ = "America/Sao_Paulo";

function offsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** `null` se o texto não for uma data/hora válida. */
export function localDateTimeToDate(value: string, tz: string = process.env.APP_TIMEZONE || DEFAULT_TZ): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const [y, m, d, hh, mm] = match.slice(1).map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  // duas passadas: o deslocamento depende do próprio instante (horário de verão)
  let guess = wall - offsetMinutes(new Date(wall), tz) * 60_000;
  guess = wall - offsetMinutes(new Date(guess), tz) * 60_000;
  return new Date(guess);
}
