"use client";

import { DndContext, MouseSensor, pointerWithin, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { canDrag, moveToDay } from "@/lib/agenda/drag";
import { itemsByDay, timeLabel, type AgendaItem } from "@/lib/agenda/view";
import { cn } from "@/lib/cn";
import { addDays, diffDays, formatDateLong, formatWeekday, monthGrid, startOfMonth, WEEKDAYS_SHORT, type ISODate } from "@/lib/dates";
import { itemDataProps, itemSummary, LAYER_MARK, TONE_CLASS } from "../ui";
import { DND_ANNOUNCEMENTS, DND_INSTRUCTIONS, suppressNextClick } from "./dnd";
import { ItemRow } from "./item-row";
import { useMover } from "./move";
import { SlotButton } from "./quick-create";

const MAX_PER_DAY = 3;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type DragData = { item: AgendaItem; day: ISODate };

function MonthChip({ item, day, draggable }: { item: AgendaItem; day: ISODate; draggable: boolean }) {
  const filled = item.startTime === null || item.endDate > item.date || item.masked;
  const time = timeLabel(item);
  const drag = useDraggable({ id: `${item.key}|${day}`, data: { item, day } satisfies DragData, disabled: !draggable });
  const style: CSSProperties | undefined = drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`, zIndex: 40 } : undefined;
  const common = {
    ref: drag.setNodeRef,
    ...(draggable ? drag.listeners : {}),
    href: item.href,
    draggable: false,
    title: itemSummary(item, time),
    "data-arrastavel": draggable ? "" : undefined,
    "data-arrastando": drag.isDragging ? "" : undefined,
    "data-evento": item.key,
    style,
  };
  if (filled) {
    return (
      <Link {...common} {...itemDataProps(item)} className={cn("agenda-evento relative flex h-[1.375rem] items-center gap-1 px-1.5 text-xs font-semibold", TONE_CLASS[item.color])}>
        {item.source !== "event" ? <span aria-hidden="true">{LAYER_MARK[item.source]}</span> : null}
        {item.masked ? <Lock aria-hidden="true" className="size-3 shrink-0" /> : null}
        <span className="truncate">
          {item.date < day ? "… " : ""}
          {item.masked && item.startTime ? `${item.startTime} ` : ""}
          {item.title}
        </span>
      </Link>
    );
  }
  return (
    <Link
      {...common}
      className={cn(
        "agenda-chip hover:bg-superficie-alta text-texto relative flex h-[1.375rem] items-center gap-1.5 rounded-md px-1 text-xs",
        item.status === "cancelado" && "text-texto-suave line-through",
      )}
    >
      <span aria-hidden="true" className={cn("agenda-ponto size-2", TONE_CLASS[item.color], item.status === "a_confirmar" && "opacity-60")} />
      <span className="text-texto-suave shrink-0 tabular-nums">{item.startTime}</span>
      <span className="truncate font-semibold">{item.title}</span>
    </Link>
  );
}

/** Célula de um dia: recebe compromissos arrastados (o destino fica destacado). */
function DayCell({ day, className, children }: { day: ISODate; className: string; children: ReactNode }) {
  const drop = useDroppable({ id: day });
  return (
    <div ref={drop.setNodeRef} data-dia={day} className={cn(className, drop.isOver && "agenda-destino")}>
      {children}
    </div>
  );
}

type Props = {
  month: ISODate;
  today: ISODate;
  /** Dia selecionado (no celular, a lista abaixo da grade mostra este dia). */
  selected: ISODate;
  items: AgendaItem[];
  dayHrefs: Record<ISODate, string>;
  /** Link que seleciona o dia mantendo a visão de mês (usado no celular). */
  selectHrefs: Record<ISODate, string>;
  newHref: string;
};

/**
 * Visão de mês. No computador: até três compromissos por dia e "+N" que abre o dia; clicar no espaço vazio do
 * dia cria; arrastar um compromisso para outro dia muda a data (o horário continua). No celular: a grade mostra
 * pontos coloridos e, embaixo, a lista do dia tocado — lá, mudar de dia é em "Reagendar".
 */
export function MonthView({ month, today, selected, items: serverItems, dayHrefs, selectHrefs, newHref }: Props) {
  const mover = useMover();
  const items = useMemo(() => mover.apply(serverItems), [mover, serverItems]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => itemsByDay(items, weeks.flat()), [items, weeks]);
  const monthKey = startOfMonth(month).slice(0, 7);
  const selectedItems = byDay.get(selected) ?? [];
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 380, tolerance: 8 } }));

  const onDragEnd = (event: DragEndEvent) => {
    suppressNextClick.release();
    const data = event.active.data.current as DragData | undefined;
    const target = event.over?.id;
    if (!data || typeof target !== "string" || target === data.day) return;
    // soltou a N dias de onde pegou: o compromisso inteiro anda N dias
    mover.request(data.item, moveToDay(data.item, addDays(data.item.date, diffDays(data.day, target))));
  };

  return (
    <DndContext
      id="agenda-mes"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={() => suppressNextClick.arm()}
      onDragEnd={onDragEnd}
      onDragCancel={() => suppressNextClick.release()}
      accessibility={{ announcements: DND_ANNOUNCEMENTS, screenReaderInstructions: DND_INSTRUCTIONS }}
    >
      <div className="card agenda-impressao overflow-hidden">
        <div aria-hidden="true" className="border-borda text-texto-suave grid grid-cols-7 border-b text-center text-[0.6875rem] font-bold tracking-wide uppercase">
          {WEEKDAYS_SHORT.map((name) => (
            <span key={name} className="py-2">
              {name}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="border-borda grid grid-cols-7 border-b last:border-b-0">
            {week.map((day) => {
              const list = byDay.get(day) ?? [];
              const outside = day.slice(0, 7) !== monthKey;
              const extra = list.length - MAX_PER_DAY;
              const label = formatDateLong(day);
              return (
                <DayCell
                  key={day}
                  day={day}
                  className={cn(
                    "group/dia border-borda relative min-h-14 min-w-0 border-r p-1 last:border-r-0 sm:min-h-[7.25rem]",
                    outside && "bg-fundo/40",
                    day === selected && "max-sm:bg-detalhe-suave/50",
                  )}
                >
                  {/* computador: o fundo da célula cria um compromisso no dia */}
                  <SlotButton date={day} startTime="09:00" label={`Novo compromisso em ${label}`} className="absolute inset-0 cursor-cell max-sm:hidden focus-visible:outline-offset-[-2px]" />
                  {/* celular: a célula inteira seleciona o dia (a lista aparece abaixo da grade) */}
                  <Link href={selectHrefs[day] ?? "#"} scroll={false} aria-label={`${label}: ${list.length} ${list.length === 1 ? "item" : "itens"}`} className="absolute inset-0 sm:hidden" />
                  <div className="pointer-events-none relative flex items-center justify-center sm:justify-between">
                    <Link
                      href={dayHrefs[day] ?? "#"}
                      aria-label={`Abrir ${label}`}
                      aria-current={day === today ? "date" : undefined}
                      className={cn(
                        "pointer-events-auto flex size-7 items-center justify-center rounded-full text-[0.8125rem] font-bold tabular-nums max-sm:pointer-events-none",
                        day === today ? "bg-primaria text-sobre-primaria" : outside ? "text-texto-suave/70 hover:bg-detalhe-suave" : "text-texto hover:bg-detalhe-suave",
                      )}
                    >
                      {Number(day.slice(8))}
                    </Link>
                    <span aria-hidden="true" className="text-detalhe pr-1 opacity-0 transition-opacity group-hover/dia:opacity-100 max-sm:hidden">
                      <Plus className="size-4" />
                    </span>
                  </div>
                  {/* computador: até três itens */}
                  <ul className="mt-0.5 space-y-0.5 max-sm:hidden">
                    {list.slice(0, extra === 1 ? MAX_PER_DAY + 1 : MAX_PER_DAY).map((item) => (
                      <li key={item.key}>
                        <MonthChip item={item} day={day} draggable={mover.enabled && canDrag(item)} />
                      </li>
                    ))}
                    {extra > 1 ? (
                      <li>
                        <Link href={dayHrefs[day] ?? "#"} className="text-detalhe hover:bg-detalhe-suave relative flex h-[1.375rem] items-center rounded-md px-1.5 text-xs font-bold">
                          +{extra} <span className="sr-only">itens em {label}</span>
                          <span aria-hidden="true">&nbsp;mais</span>
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                  {/* celular: pontos */}
                  {list.length > 0 ? (
                    <div aria-hidden="true" className="pointer-events-none relative mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
                      {list.slice(0, 4).map((item) => (
                        <span key={item.key} className={cn("agenda-ponto size-1.5", item.masked ? "agenda-tom-cinza" : TONE_CLASS[item.color])} />
                      ))}
                    </div>
                  ) : null}
                </DayCell>
              );
            })}
          </div>
        ))}
      </div>

      {/* celular: o dia selecionado */}
      <section aria-labelledby="dia-selecionado" className="mt-4 sm:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="dia-selecionado" className="text-texto text-base font-bold">
            {capitalize(formatWeekday(selected))}, {formatDateLong(selected).replace(/ de \d{4}$/, "")}
          </h2>
          <Link href={dayHrefs[selected] ?? "#"} className="link inline-flex min-h-11 shrink-0 items-center text-sm whitespace-nowrap">
            Abrir o dia
          </Link>
        </div>
        {selectedItems.length === 0 ? (
          <p className="border-borda-forte text-texto-suave rounded-cartao border border-dashed px-4 py-6 text-center text-sm">
            Nada marcado neste dia.{" "}
            <Link href={`${newHref}${newHref.includes("?") ? "&" : "?"}data=${selected}`} className="link">
              Criar compromisso
            </Link>
          </p>
        ) : (
          <ul className="card divide-borda divide-y overflow-hidden">
            {selectedItems.map((item) => (
              <li key={item.key}>
                <ItemRow item={item} day={selected} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </DndContext>
  );
}
