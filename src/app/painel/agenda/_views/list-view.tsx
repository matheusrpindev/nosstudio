import { CalendarPlus, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { itemsByDay, type AgendaItem } from "@/lib/agenda/view";
import { addDays, formatDateLong, formatRelativeDay, formatWeekday, type ISODate } from "@/lib/dates";
import { ItemRow } from "./item-row";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Props = { from: ISODate; to: ISODate; today: ISODate; items: AgendaItem[]; q: string; newHref: string; canEdit: boolean };

/** Visão de lista: os compromissos do período agrupados por dia (um de vários dias aparece em cada dia). */
export function ListView({ from, to, today, items, q, newHref, canEdit }: Props) {
  const days: ISODate[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  const groups = [...itemsByDay(items, days).entries()].filter(([, list]) => list.length > 0);

  if (groups.length === 0) {
    return q ? (
      <EmptyState icon={<SearchX />} title={`Nada encontrado para “${q}”`} description="A busca olha título, descrição, local, cliente, projeto e pessoas, de seis meses atrás até um ano à frente." />
    ) : (
      <EmptyState
        icon={<CalendarPlus />}
        title="Nada marcado neste período"
        description="Mude o período, confira os filtros ou crie um compromisso."
        action={canEdit ? <ButtonLink href={newHref}>Novo compromisso</ButtonLink> : undefined}
      />
    );
  }
  return (
    <ol className="space-y-5">
      {groups.map(([day, list]) => {
        const relative = formatRelativeDay(day, today);
        return (
          <li key={day}>
            <h2 className="text-texto mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm font-bold">
              {capitalize(formatWeekday(day))}, {formatDateLong(day)}
              {relative === "hoje" || relative === "amanhã" || relative === "ontem" ? <span className="text-primaria font-semibold">{relative}</span> : null}
            </h2>
            <ul className="card divide-borda divide-y overflow-hidden">
              {list.map((item) => (
                <li key={item.key}>
                  <ItemRow item={item} day={day} />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
