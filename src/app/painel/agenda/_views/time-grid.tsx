"use client";

import { Lock, Repeat } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { layoutDay, minutesToTime, timeToMinutes } from "@/lib/agenda/conflicts";
import { isAllDay, itemsByDay, timeLabel, type AgendaItem } from "@/lib/agenda/view";
import { cn } from "@/lib/cn";
import { formatDateLong, formatWeekday, nowLocal, type ISODate } from "@/lib/dates";
import { itemDataProps, itemSummary, LAYER_MARK, TONE_CLASS } from "../ui";
import { SlotButton, useQuickCreate } from "./quick-create";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** Altura mínima de um bloco, em minutos (alvo de toque e espaço para o título). */
const MIN_BLOCK = 40;
const MAX_ALL_DAY = 3;

type Props = {
  days: ISODate[];
  items: AgendaItem[];
  today: ISODate;
  /** Dia selecionado (no celular a semana rola até ele). */
  selected: ISODate;
  /** Link para a visão de dia de cada data. */
  dayHrefs: Record<ISODate, string>;
};

function AllDayChip({ item, day }: { item: AgendaItem; day: ISODate }) {
  const continues = item.date < day;
  return (
    <Link
      href={item.href}
      title={itemSummary(item, timeLabel(item))}
      {...itemDataProps(item)}
      className={cn("agenda-evento flex min-h-6 items-center gap-1 px-2 py-0.5 text-xs font-semibold", TONE_CLASS[item.color])}
    >
      {item.source !== "event" ? <span aria-hidden="true">{LAYER_MARK[item.source]}</span> : null}
      {item.masked ? <Lock aria-hidden="true" className="size-3 shrink-0" /> : null}
      <span className="truncate">
        {continues ? "… " : ""}
        {item.startTime && !continues ? `${item.startTime} ` : ""}
        {item.title}
      </span>
    </Link>
  );
}

/**
 * Grade de horas (visões Dia e Semana): faixa de "dia inteiro" no topo, compromissos posicionados com
 * `layoutDay` (sobrepostos lado a lado), linha do "agora" e clique num horário vazio para criar.
 */
export function TimeGrid({ days, items, today, selected, dayHrefs }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const openQuick = useQuickCreate();
  const [now, setNow] = useState<{ date: ISODate; minutes: number } | null>(null);

  const byDay = useMemo(() => itemsByDay(items, days), [items, days]);
  const columns = useMemo(
    () =>
      days.map((day) => {
        const list = byDay.get(day) ?? [];
        const allDay = list.filter((item) => isAllDay(item));
        const timed = list.filter((item) => !isAllDay(item));
        const placements = new Map(layoutDay(timed.map((item) => ({ key: item.key, startTime: item.startTime as string, endTime: item.endTime })), MIN_BLOCK).map((placement) => [placement.key, placement]));
        return { day, allDay, timed, placements };
      }),
    [byDay, days],
  );

  // "agora" só existe no navegador (evita divergência com o HTML do servidor) e anda a cada minuto
  useEffect(() => {
    const tick = () => {
      const [date, time] = nowLocal().split("T");
      setNow({ date, minutes: timeToMinutes(time) });
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // rolagem inicial: perto do horário atual (ou do primeiro compromisso) e, no celular, até o dia selecionado
  const firstKey = `${days[0]}|${selected}`;
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const hour = (box.querySelector<HTMLElement>("[data-coluna]")?.offsetHeight ?? 1152) / 24;
    const [date, time] = nowLocal().split("T");
    const showsToday = days.includes(date);
    const firstStart = Math.min(...items.filter((item) => item.startTime && item.date === item.endDate).map((item) => timeToMinutes(item.startTime as string)), 24 * 60);
    const anchor = showsToday ? timeToMinutes(time) - 90 : Math.min(firstStart - 60, 7 * 60);
    box.scrollTop = Math.max(0, (anchor / 60) * hour - 10); // 10px de folga: o rótulo da hora não fica sob o cabeçalho
    const column = box.querySelector<HTMLElement>(`[data-coluna="${selected}"]`);
    const ruler = box.querySelector<HTMLElement>("[data-regua]");
    if (column && box.scrollWidth > box.clientWidth) box.scrollLeft = Math.max(0, column.offsetLeft - (ruler?.offsetWidth ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar de período/dia, não a cada dado novo
  }, [firstKey]);

  const createAt = (day: ISODate, event: MouseEvent<HTMLDivElement>) => {
    if (!openQuick || (event.target as HTMLElement).closest("a,button")) return;
    const box = event.currentTarget.getBoundingClientRect();
    // o clique cai dentro de uma faixa de 30 minutos: o compromisso começa no início dela
    const minutes = Math.min(Math.floor((((event.clientY - box.top) / box.height) * 24 * 60) / 30) * 30, 23 * 60);
    openQuick({ date: day, startTime: minutesToTime(minutes), endTime: minutesToTime(Math.min(minutes + 60, 23 * 60 + 59)) });
  };

  return (
    <div className="card overflow-hidden">
      <div
        ref={scroller}
        tabIndex={0}
        role="group"
        aria-label={days.length === 1 ? `Compromissos de ${formatDateLong(days[0])}` : "Compromissos da semana, por dia e horário"}
        className="relative h-[calc(100dvh-15.5rem)] min-h-[26rem] snap-x overflow-auto overscroll-contain scroll-pl-[var(--agenda-regua)] outline-offset-[-2px] sm:h-[calc(100dvh-14rem)]"
      >
        <div className="agenda-grade" data-dias={days.length} style={{ "--agenda-dias": days.length } as React.CSSProperties}>
          {/* cabeçalho fixo: dias + faixa de dia inteiro */}
          <div className="agenda-grade-topo border-borda sticky top-0 z-20 border-b bg-superficie">
            <div data-regua className="border-borda sticky left-0 z-10 border-r bg-superficie" />
            {columns.map(({ day }) => (
              <div key={day} className="border-borda snap-start border-r px-1 pt-1.5 pb-1 text-center last:border-r-0">
                <Link href={dayHrefs[day] ?? "#"} aria-label={formatDateLong(day)} aria-current={day === today ? "date" : undefined} className="group inline-flex min-h-11 flex-col items-center justify-center rounded-md px-2 sm:min-h-0">
                  <span className={cn("text-[0.6875rem] font-bold tracking-wide uppercase", day === today ? "text-primaria" : "text-texto-suave")}>{formatWeekday(day, true)}</span>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-base font-bold tabular-nums",
                      day === today ? "bg-primaria text-sobre-primaria" : "text-texto group-hover:bg-detalhe-suave",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                </Link>
              </div>
            ))}
            <div className="border-borda text-texto-suave sticky left-0 z-10 flex items-start justify-end border-t border-r bg-superficie px-1 pt-1.5 text-[0.625rem] leading-tight font-semibold">
              <span className="text-right">dia inteiro</span>
            </div>
            {columns.map(({ day, allDay }) => (
              <div key={day} className="border-borda relative min-h-8 space-y-0.5 border-t border-r p-0.5 last:border-r-0">
                <SlotButton date={day} label={`Novo compromisso de dia inteiro em ${formatDateLong(day)}`} className="absolute inset-0 cursor-cell rounded-sm focus-visible:outline-offset-[-2px]" />
                {allDay.slice(0, MAX_ALL_DAY).map((item) => (
                  <div key={item.key} className="relative">
                    <AllDayChip item={item} day={day} />
                  </div>
                ))}
                {allDay.length > MAX_ALL_DAY ? (
                  <Link href={dayHrefs[day] ?? "#"} className="text-detalhe hover:bg-detalhe-suave relative block rounded px-2 py-0.5 text-xs font-semibold">
                    +{allDay.length - MAX_ALL_DAY} <span className="sr-only">compromissos de dia inteiro em {formatDateLong(day)}</span>
                  </Link>
                ) : null}
              </div>
            ))}
          </div>

          {/* corpo: régua das horas + uma coluna por dia (mesma estrutura do topo, para a régua ficar presa à esquerda) */}
          <div className="agenda-grade-topo">
            <div className="border-borda sticky left-0 z-10 border-r bg-superficie" aria-hidden="true">
              {HOURS.map((hour) => (
                <div key={hour} className="text-texto-suave relative h-[var(--agenda-hora)] pr-1.5 text-right text-[0.6875rem] font-medium tabular-nums">
                  {hour > 0 ? <span className="relative -top-2">{String(hour).padStart(2, "0")}:00</span> : null}
                </div>
              ))}
            </div>

            {/* colunas dos dias */}
            {columns.map(({ day, timed, placements }) => (
              <div
                key={day}
                data-coluna={day}
                onClick={(event) => createAt(day, event)}
                className={cn("agenda-coluna border-borda relative border-r last:border-r-0", openQuick && "cursor-cell", day === today && "bg-detalhe-suave/25")}
              >
                {now && now.date === day ? <div className="agenda-agora" style={{ top: `calc(var(--agenda-hora) * ${now.minutes / 60})` }} aria-hidden="true" /> : null}
                <ul aria-label={formatDateLong(day)} className="contents">
                  {timed.map((item) => {
                    const place = placements.get(item.key);
                    if (!place) return null;
                    const tall = place.height >= 55;
                    const time = timeLabel(item);
                    return (
                      <li key={item.key} className="contents">
                        <Link
                          href={item.href}
                          title={itemSummary(item, time)}
                          {...itemDataProps(item)}
                          className={cn("agenda-evento absolute px-1.5 py-1 text-xs", TONE_CLASS[item.color])}
                          style={{
                            top: `calc(var(--agenda-hora) * ${place.top / 60} + 1px)`,
                            height: `calc(var(--agenda-hora) * ${place.height / 60} - 2px)`,
                            left: `calc(${(place.column / place.columns) * 100}% + 1px)`,
                            width: `calc(${100 / place.columns}% - 3px)`,
                          }}
                        >
                          <span className={cn("block font-semibold", tall ? "line-clamp-2 break-words" : "truncate")}>
                            {item.masked ? <Lock aria-hidden="true" className="mr-1 inline size-3 align-[-1px]" /> : null}
                            {item.title}
                          </span>
                          <span className="text-texto-suave flex items-center gap-1 text-[0.6875rem] tabular-nums">
                            <span className="truncate">
                              {time}
                              {item.masked && item.ownerName ? ` · ${item.ownerName.split(" ")[0]}` : ""}
                            </span>
                            {item.recurring ? <Repeat aria-hidden="true" className="size-3 shrink-0" /> : null}
                          </span>
                          {tall && item.location ? <span className="text-texto-suave block truncate text-[0.6875rem]">{item.location}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
