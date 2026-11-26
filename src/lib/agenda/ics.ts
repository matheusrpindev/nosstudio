/**
 * Exportação da agenda em iCalendar (RFC 5545) — lógica pura, testada em `ics.test.ts` com um leitor mínimo.
 *
 * - horários saem no fuso do estúdio (`DTSTART;TZID=America/Sao_Paulo:…`) com o bloco `VTIMEZONE` correspondente
 *   (Brasília não tem horário de verão desde 2019: UTC−03:00 o ano todo);
 * - dia inteiro sai como `VALUE=DATE`, com o fim EXCLUSIVO (dia seguinte ao último);
 * - a repetição vira `RRULE` e os dias que não acontecem viram `EXDATE`;
 * - quem monta a lista decide o que cada pessoa pode ver: aqui um compromisso mascarado já chega só com
 *   "Ocupado" e o horário.
 */
import { addDays, weekday, type ISODate } from "@/lib/dates";
import { DEFAULT_DURATION_MIN, minutesToTime, timeToMinutes } from "./conflicts";
import { lastOccurrence, type Recurrence } from "./recurrence";

export const ICS_TIMEZONE = "America/Sao_Paulo";
/** Diferença do fuso para o UTC, em horas (para escrever `UNTIL` em UTC). */
const UTC_OFFSET_HOURS = -3;

export type IcsStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  date: ISODate;
  /** Último dia (igual a `date` quando termina no mesmo dia). */
  endDate: ISODate;
  startTime: string | null;
  endTime: string | null;
  recurrence: Recurrence | null;
  exceptions: readonly ISODate[];
  status: IcsStatus;
  /** Particular (de quem exporta) ou mascarado: `CLASS:PRIVATE`. */
  private: boolean;
  url?: string;
  categories?: string;
  updatedAt?: Date;
  /** Lembretes, em minutos antes do início. */
  alarms?: readonly number[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const compactDate = (iso: ISODate) => iso.replaceAll("-", "");
const compactTime = (time: string) => `${time.replace(":", "")}00`;
const local = (iso: ISODate, time: string) => `${compactDate(iso)}T${compactTime(time)}`;

/** Instante em UTC no formato básico: `20261201T130000Z`. */
export function utcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Escapa texto (RFC 5545 §3.3.11): barra, ponto e vírgula, vírgula e quebras de linha. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Dobra a linha em pedaços de até 75 octetos (UTF-8), sem partir um caractere; a continuação começa com espaço. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // as linhas de continuação gastam 1 octeto com o espaço inicial
    if (size + bytes > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Fim do dia `until` (23:59:59 no fuso do estúdio) em UTC. */
function untilUtc(until: ISODate): string {
  const hour = 23 - UTC_OFFSET_HOURS; // 23h locais = 26h UTC → dia seguinte, 02h
  const day = hour >= 24 ? addDays(until, 1) : until;
  return `${compactDate(day)}T${pad(hour % 24)}5959Z`;
}

/**
 * A regra de repetição como `RRULE`. O RFC não aceita `UNTIL` e `COUNT` juntos: quando a regra tem os dois, vale
 * o que vier antes — calculado aqui como a data da última ocorrência.
 */
export function rrule(start: ISODate, rule: Recurrence, allDay: boolean): string {
  const parts: string[] = [];
  const interval = Math.max(1, rule.interval);
  if (rule.freq === "diaria") parts.push("FREQ=DAILY");
  if (rule.freq === "semanal") parts.push("FREQ=WEEKLY");
  if (rule.freq === "mensal") parts.push("FREQ=MONTHLY");
  if (rule.freq === "anual") parts.push("FREQ=YEARLY");
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (rule.freq === "semanal") {
    const days = rule.weekdays?.length ? rule.weekdays : [weekday(start)];
    parts.push(`BYDAY=${[...days].sort((a, b) => a - b).map((day) => BYDAY[day]).join(",")}`);
    // as semanas da regra contam a partir do domingo (como em `recurrence.ts`)
    parts.push("WKST=SU");
  }
  // mensal no dia 31 pula os meses sem dia 31, como manda o RFC — a mesma regra de `recurrence.ts`
  if (rule.freq === "mensal") parts.push(`BYMONTHDAY=${Number(start.slice(8))}`);
  const until = rule.until && rule.count ? lastOccurrence(start, rule) : (rule.until ?? null);
  if (until) parts.push(`UNTIL=${allDay ? compactDate(until) : untilUtc(until)}`);
  else if (rule.count) parts.push(`COUNT=${rule.count}`);
  return parts.join(";");
}

function eventLines(event: IcsEvent, stamp: string): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${stamp}`];
  const allDay = event.startTime === null;
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(event.endDate, 1))}`);
  } else {
    const start = event.startTime as string;
    lines.push(`DTSTART;TZID=${ICS_TIMEZONE}:${local(event.date, start)}`);
    // sem hora de fim, vale a duração padrão da agenda (1 hora), sem passar da meia-noite
    const end = event.endTime ?? (event.endDate > event.date ? "23:59" : minutesToTime(Math.min(timeToMinutes(start) + DEFAULT_DURATION_MIN, 23 * 60 + 59)));
    lines.push(`DTEND;TZID=${ICS_TIMEZONE}:${local(event.endDate, end)}`);
  }
  if (event.recurrence) {
    lines.push(`RRULE:${rrule(event.date, event.recurrence, allDay)}`);
    const exceptions = [...new Set(event.exceptions)].filter((day) => day >= event.date).sort();
    for (const day of exceptions) {
      lines.push(allDay ? `EXDATE;VALUE=DATE:${compactDate(day)}` : `EXDATE;TZID=${ICS_TIMEZONE}:${local(day, event.startTime as string)}`);
    }
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.categories) lines.push(`CATEGORIES:${escapeText(event.categories)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push(`STATUS:${event.status}`);
  lines.push(`CLASS:${event.private ? "PRIVATE" : "PUBLIC"}`);
  lines.push(`TRANSP:${event.status === "CANCELLED" ? "TRANSPARENT" : "OPAQUE"}`);
  if (event.updatedAt) lines.push(`LAST-MODIFIED:${utcStamp(event.updatedAt)}`);
  for (const minutes of event.alarms ?? []) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.title)}`, `TRIGGER:-PT${Math.max(0, Math.trunc(minutes))}M`, "END:VALARM");
  }
  lines.push("END:VEVENT");
  return lines;
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${ICS_TIMEZONE}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** O arquivo `.ics` completo (linhas dobradas, terminadas em CRLF). `now` vira o `DTSTAMP` de todos os eventos. */
export function buildCalendar(events: readonly IcsEvent[], options: { name: string; now: Date }): string {
  const stamp = utcStamp(options.now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NOS Studio//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `X-WR-TIMEZONE:${ICS_TIMEZONE}`,
    ...VTIMEZONE,
    ...events.flatMap((event) => eventLines(event, stamp)),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
