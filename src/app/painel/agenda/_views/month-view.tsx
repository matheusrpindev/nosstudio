import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { itemsByDay, timeLabel, type AgendaItem } from "@/lib/agenda/view";
import { cn } from "@/lib/cn";
import { formatDateLong, formatWeekday, monthGrid, startOfMonth, WEEKDAYS_SHORT, type ISODate } from "@/lib/dates";
import { itemDataProps, itemSummary, LAYER_MARK, TONE_CLASS } from "../ui";
import { ItemRow } from "./item-row";
import { SlotButton } from "./quick-create";

const MAX_PER_DAY = 3;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function MonthChip({ item, day }: { item: AgendaItem; day: ISODate }) {
  const filled = item.startTime === null || item.endDate > item.date || item.masked;
  const time = timeLabel(item);
  if (filled) {
    return (
      <Link href={item.href} title={itemSummary(item, time)} {...itemDataProps(item)} className={cn("agenda-evento relative flex h-[1.375rem] items-center gap-1 px-1.5 text-xs font-semibold", TONE_CLASS[item.color])}>
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
      href={item.href}
      title={itemSummary(item, time)}
      className={cn(
        "hover:bg-superficie-alta text-texto relative flex h-[1.375rem] items-center gap-1.5 rounded-md px-1 text-xs",
        item.status === "cancelado" && "text-texto-suave line-through",
      )}
    >
      <span aria-hidden="true" className={cn("agenda-ponto size-2", TONE_CLASS[item.color], item.status === "a_confirmar" && "opacity-60")} />
      <span className="text-texto-suave shrink-0 tabular-nums">{item.startTime}</span>
      <span className="truncate font-semibold">{item.title}</span>
    </Link>
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
 * dia cria. No celular: a grade mostra pontos coloridos e, embaixo, a lista do dia tocado.
 */
export function MonthView({ month, today, selected, items, dayHrefs, selectHrefs, newHref }: Props) {
  const weeks = monthGrid(month);
  const byDay = itemsByDay(items, weeks.flat());
  const monthKey = startOfMonth(month).slice(0, 7);
  const selectedItems = byDay.get(selected) ?? [];

  return (
    <div>
      <div className="card overflow-hidden">
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
                <div
                  key={day}
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
                        <MonthChip item={item} day={day} />
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
                </div>
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
    </div>
  );
}
