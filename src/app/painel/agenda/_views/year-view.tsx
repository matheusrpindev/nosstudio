import Link from "next/link";
import type { AgendaItem } from "@/lib/agenda/view";
import { cn } from "@/lib/cn";
import { addDays, addMonths, formatDateLong, formatMonth, monthGrid, WEEKDAYS_SHORT, type ISODate } from "@/lib/dates";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** 0 = vazio … 3 = cheio. */
const heat = (count: number) => (count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3);

type Props = { year: number; today: ISODate; items: AgendaItem[]; dayHref: (day: ISODate) => string; monthHref: (month: ISODate) => string };

/**
 * Visão de ano: doze mini-meses; a cor de cada dia indica quanto há marcado. No computador o dia abre a visão
 * de dia e o nome do mês abre o mês; no celular o mini-mês inteiro abre o mês (os dias são pequenos para tocar).
 */
export function YearView({ year, today, items, dayHref, monthHref }: Props) {
  const counts = new Map<ISODate, number>();
  for (const item of items) {
    if (item.status === "cancelado") continue;
    for (let day = item.date; day <= item.endDate; day = addDays(day, 1)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const months = Array.from({ length: 12 }, (_, index) => addMonths(`${year}-01-01`, index));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => {
          const key = month.slice(0, 7);
          const total = [...counts.entries()].filter(([day]) => day.startsWith(key)).reduce((sum, [, count]) => sum + count, 0);
          return (
            <section key={month} aria-label={formatMonth(month)} className={cn("card relative p-2.5 sm:p-3", today.startsWith(key) && "border-detalhe-medio")}>
              <h2 className="mb-1.5 flex items-baseline justify-between gap-2">
                <Link href={monthHref(month)} className="text-texto hover:text-detalhe text-sm font-bold max-sm:after:absolute max-sm:after:inset-0">
                  {capitalize(formatMonth(month).split(" ")[0])}
                </Link>
                <span className="text-texto-suave text-[0.6875rem] tabular-nums">{total > 0 ? `${total} ${total === 1 ? "item" : "itens"}` : ""}</span>
              </h2>
              <div aria-hidden="true" className="text-texto-suave grid grid-cols-7 text-center text-[0.625rem] font-semibold uppercase">
                {WEEKDAYS_SHORT.map((name) => (
                  <span key={name}>{name.charAt(0)}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {monthGrid(month).flat().map((day) => {
                  if (!day.startsWith(key)) return <span key={day} />;
                  const count = counts.get(day) ?? 0;
                  const level = heat(count);
                  return (
                    <Link
                      key={day}
                      href={dayHref(day)}
                      aria-label={`${formatDateLong(day)}${count ? `: ${count} ${count === 1 ? "item" : "itens"}` : ""}`}
                      className={cn(
                        "text-texto hover:ring-detalhe flex aspect-square items-center justify-center rounded-md text-[0.6875rem] font-medium tabular-nums hover:ring-1 max-sm:pointer-events-none sm:text-xs",
                        level === 1 && "agenda-calor-1",
                        level === 2 && "agenda-calor-2",
                        level === 3 && "agenda-calor-3 font-bold",
                        day === today && "ring-primaria ring-2",
                      )}
                    >
                      {Number(day.slice(8))}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-texto-suave mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>Quanto há marcado no dia:</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="agenda-calor-1 size-3.5 rounded" /> 1
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="agenda-calor-2 size-3.5 rounded" /> 2 ou 3
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="agenda-calor-3 size-3.5 rounded" /> 4 ou mais
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="ring-primaria size-3.5 rounded ring-2" /> hoje
        </span>
      </p>
    </div>
  );
}
