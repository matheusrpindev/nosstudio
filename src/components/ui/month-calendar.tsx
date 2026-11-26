/**
 * <MonthCalendar>: grade mensal (domingo → sábado) com navegação por link (?mes=YYYY-MM).
 * Sem estado e sem "use client": pode ser usado direto numa página (Server Component).
 * No celular (< 640px) a grade vira uma lista agrupada por dia (só dias com itens + hoje).
 *
 * "Hoje" é passado por quem chama (`todayISO()` depois de `await requireUser()`), nunca calculado aqui.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addMonths,
  formatDateLong,
  formatMonth,
  formatWeekday,
  isISODate,
  monthGrid,
  startOfMonth,
  WEEKDAYS_SHORT,
  type ISODate,
} from "@/lib/dates";

export type CalendarTone = "neutral" | "roxo" | "lima" | "sucesso" | "alerta" | "perigo";

export type CalendarItem = {
  id: number | string;
  /** Dia do item, `YYYY-MM-DD`. */
  date: ISODate;
  title: string;
  /** Horário `HH:mm` (opcional). Itens sem horário aparecem primeiro. */
  time?: string | null;
  tone?: CalendarTone;
  /** Se informado, o item vira link. */
  href?: string;
};

export type MonthCalendarProps = {
  /** Mês exibido: `YYYY-MM-01` (use `parseMonthParam`). */
  month: ISODate;
  /** Data de hoje (`todayISO()`), para o destaque e o botão "Hoje". */
  today: ISODate;
  items: CalendarItem[];
  /** Caminho da página (pode já ter outros parâmetros: `/painel/agenda?tipo=gravacao`). */
  baseHref: string;
  /** Nome do parâmetro de mês na URL. Padrão: `mes`. */
  param?: string;
  /** Máximo de itens visíveis por dia na grade; o resto fica em "+N". Padrão: 3. */
  maxPerDay?: number;
  /** Conteúdo extra por dia (ex.: link "novo item" já com a data). */
  daySlot?: (date: ISODate) => ReactNode;
  /** Nome acessível do calendário. Padrão: "Calendário". */
  label?: string;
  className?: string;
};

/** Lê o parâmetro `?mes=YYYY-MM` de `searchParams` e devolve `YYYY-MM-01` (mês de hoje se ausente/inválido). */
export function parseMonthParam(value: string | string[] | undefined, today: ISODate): ISODate {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && /^\d{4}-\d{2}$/.test(raw) && isISODate(`${raw}-01`)) {
    const year = Number(raw.slice(0, 4));
    if (year >= 2000 && year <= 2100) return `${raw}-01`;
  }
  return startOfMonth(today);
}

const TONE_CHIP: Record<CalendarTone, string> = {
  neutral: "bg-borda/70 text-texto",
  roxo: "bg-detalhe-suave text-detalhe",
  lima: "bg-lima text-grafite",
  sucesso: "bg-sucesso-claro text-sucesso",
  alerta: "bg-alerta-claro text-alerta",
  perigo: "bg-perigo-claro text-perigo",
};
const TONE_DOT: Record<CalendarTone, string> = {
  neutral: "bg-texto-suave",
  roxo: "bg-detalhe",
  lima: "bg-lima",
  sucesso: "bg-sucesso",
  alerta: "bg-alerta",
  perigo: "bg-perigo",
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function monthHref(baseHref: string, param: string, month: ISODate): string {
  return `${baseHref}${baseHref.includes("?") ? "&" : "?"}${param}=${month.slice(0, 7)}`;
}

function byTime(a: CalendarItem, b: CalendarItem): number {
  return (a.time ?? "").localeCompare(b.time ?? "");
}

/** Etiqueta compacta de um item na grade. */
function Chip({ item }: { item: CalendarItem }) {
  const className = cn(
    "block truncate rounded-md px-1.5 py-0.5 text-xs leading-5 font-medium",
    TONE_CHIP[item.tone ?? "roxo"],
    item.href && "hover:brightness-95 focus-visible:outline-offset-1",
  );
  const title = item.time ? `${item.time} · ${item.title}` : item.title;
  const content = (
    <>
      {item.time ? <span className="font-bold tabular-nums">{item.time} </span> : null}
      {item.title}
    </>
  );
  return item.href ? (
    <Link href={item.href} className={className} title={title}>
      {content}
    </Link>
  ) : (
    <span className={className} title={title}>
      {content}
    </span>
  );
}

export function MonthCalendar({
  month,
  today,
  items,
  baseHref,
  param = "mes",
  maxPerDay = 3,
  daySlot,
  label = "Calendário",
  className,
}: MonthCalendarProps) {
  const first = startOfMonth(month);
  const monthKey = first.slice(0, 7);
  const weeks = monthGrid(first);
  const title = capitalize(formatMonth(first));
  const previous = addMonths(first, -1);
  const next = addMonths(first, 1);
  const isCurrentMonth = today.slice(0, 7) === monthKey;

  const byDay = new Map<ISODate, CalendarItem[]>();
  for (const item of items) {
    const list = byDay.get(item.date);
    if (list) list.push(item);
    else byDay.set(item.date, [item]);
  }
  for (const list of byDay.values()) list.sort(byTime);

  // Lista do celular: dias do mês com itens + hoje (se estiver neste mês).
  const listDays = weeks
    .flat()
    .filter((date) => date.slice(0, 7) === monthKey && (byDay.has(date) || date === today));

  return (
    <section aria-label={`${label}: ${title}`} className={className}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-texto text-xl font-bold tracking-tight sm:text-2xl" aria-live="polite">
          {title}
        </h2>
        <nav aria-label="Navegação do calendário" className="flex items-center gap-2">
          {/* sempre um link (mesmo no mês atual), para o controle não mudar de tipo ao navegar */}
          <Link href={monthHref(baseHref, param, startOfMonth(today))} className="btn btn-secondary" aria-current={isCurrentMonth ? "true" : undefined}>
            Hoje
          </Link>
          <Link
            href={monthHref(baseHref, param, previous)}
            className="btn btn-secondary btn-icon"
            aria-label={`Mês anterior: ${formatMonth(previous)}`}
            title="Mês anterior"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <Link
            href={monthHref(baseHref, param, next)}
            className="btn btn-secondary btn-icon"
            aria-label={`Próximo mês: ${formatMonth(next)}`}
            title="Próximo mês"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        </nav>
      </header>

      {/* ---------- grade (≥ 640px) */}
      <div className="card relative hidden overflow-hidden sm:block">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              {WEEKDAYS_SHORT.map((name, index) => (
                <th
                  key={name}
                  scope="col"
                  abbr={formatWeekday(weeks[0][index])}
                  className="border-borda text-texto-suave bg-superficie-alta/60 border-b px-2 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((date, column) => {
                  const outside = date.slice(0, 7) !== monthKey;
                  const isToday = date === today;
                  const dayItems = byDay.get(date) ?? [];
                  const visible = dayItems.length > maxPerDay ? dayItems.slice(0, maxPerDay - 1) : dayItems;
                  const hidden = dayItems.slice(visible.length);
                  const slot = daySlot?.(date);
                  return (
                    <td
                      key={date}
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "group/dia border-borda h-28 border-t p-1.5 align-top lg:h-32",
                        column > 0 && "border-l",
                        outside && "bg-superficie-alta/60",
                        isToday && "bg-detalhe-suave/60",
                      )}
                    >
                      <div className="mb-1 flex min-h-7 items-center justify-between gap-1">
                        <time
                          dateTime={date}
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                            isToday ? "bg-primaria text-sobre-primaria font-bold" : outside ? "text-texto-suave/80 font-medium" : "text-texto font-semibold",
                          )}
                        >
                          <span className="sr-only">{`${formatWeekday(date)}, ${formatDateLong(date)}${isToday ? " (hoje)" : ""}: `}</span>
                          <span aria-hidden="true">{Number(date.slice(8))}</span>
                        </time>
                        {slot ? <div className="flex items-center">{slot}</div> : null}
                      </div>
                      {dayItems.length > 0 ? (
                        <ul className={cn("space-y-1", outside && "opacity-60")}>
                          {visible.map((item) => (
                            <li key={item.id}>
                              <Chip item={item} />
                            </li>
                          ))}
                          {hidden.length > 0 ? (
                            <li>
                              {/* aberto: o resumo ("Mostrar menos") vai para depois dos itens */}
                              <details className="group/mais open:flex open:flex-col-reverse open:gap-1">
                                <summary className="text-detalhe hover:bg-detalhe-suave cursor-pointer list-none rounded-md px-1.5 py-0.5 text-xs leading-5 font-semibold [&::-webkit-details-marker]:hidden">
                                  <span className="group-open/mais:hidden">
                                    +{hidden.length} <span className="sr-only">itens neste dia — mostrar</span>
                                  </span>
                                  <span className="hidden group-open/mais:inline">Mostrar menos</span>
                                </summary>
                                <ul className="space-y-1 group-not-open/mais:mt-1">
                                  {hidden.map((item) => (
                                    <li key={item.id}>
                                      <Chip item={item} />
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- lista por dia (< 640px) */}
      <div className="sm:hidden">
        {listDays.length === 0 ? (
          <p className="card text-texto-suave px-4 py-6 text-center text-sm">Nada marcado neste mês.</p>
        ) : (
          <ol className="space-y-3">
            {listDays.map((date) => {
              const isToday = date === today;
              const dayItems = byDay.get(date) ?? [];
              const slot = daySlot?.(date);
              return (
                <li key={date} aria-current={isToday ? "date" : undefined} className={cn("card relative overflow-hidden", isToday && "border-detalhe/40")}>
                  <div className={cn("flex min-h-12 items-center justify-between gap-2 px-3 py-1.5", isToday ? "bg-detalhe-suave" : "bg-superficie-alta/60")}>
                    <h3 className="flex items-center gap-2.5">
                      <time
                        dateTime={date}
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums",
                          isToday ? "bg-primaria text-sobre-primaria" : "text-texto border-borda border bg-superficie",
                        )}
                      >
                        {Number(date.slice(8))}
                      </time>
                      <span className="text-texto text-sm font-semibold">
                        {capitalize(formatWeekday(date))}
                        {isToday ? <span className="badge badge-roxo ml-2 bg-superficie">Hoje</span> : null}
                      </span>
                    </h3>
                    {slot ? <div className="flex items-center">{slot}</div> : null}
                  </div>
                  {dayItems.length === 0 ? (
                    <p className="text-texto-suave border-borda border-t px-3 py-3 text-sm">Nada marcado para hoje.</p>
                  ) : (
                    <ul className="divide-borda border-borda divide-y border-t">
                      {dayItems.map((item) => {
                        const row = (
                          <>
                            <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", TONE_DOT[item.tone ?? "roxo"])} />
                            <span className="text-texto-suave w-11 shrink-0 text-sm font-semibold tabular-nums">
                              {item.time ?? (
                                <>
                                  <span aria-hidden="true">—</span>
                                  <span className="sr-only">Sem horário</span>
                                </>
                              )}
                            </span>
                            <span className="text-texto min-w-0 flex-1 text-sm font-medium">{item.title}</span>
                            {item.href ? <ChevronRight aria-hidden="true" className="text-texto-suave size-4 shrink-0" /> : null}
                          </>
                        );
                        return (
                          <li key={item.id}>
                            {item.href ? (
                              <Link href={item.href} className="hover:bg-detalhe-suave/50 flex min-h-12 items-center gap-2.5 px-3 py-2 focus-visible:outline-offset-[-2px]">
                                {row}
                              </Link>
                            ) : (
                              <div className="flex min-h-12 items-center gap-2.5 px-3 py-2">{row}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
