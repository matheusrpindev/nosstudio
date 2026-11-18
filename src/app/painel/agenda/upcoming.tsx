import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatDateShort,
  formatRelativeDay,
  formatWeekday,
  type ISODate,
} from "@/lib/dates";
import { AGENDA_KIND_LABELS } from "@/lib/domain";
import { groupByDay, type AgendaEntry } from "@/server/agenda/logic";
import { AGENDA_KIND_TONES, DEADLINE_MARK, timeLabel } from "./ui";

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** "Próximos 14 dias": compromissos e prazos de projeto, agrupados por dia. */
export function Upcoming({
  entries,
  today,
}: {
  entries: AgendaEntry[];
  today: ISODate;
}) {
  const days = groupByDay(entries);
  return (
    <Card as="section" aria-labelledby="proximos-titulo" className="self-start">
      <CardHeader
        id="proximos-titulo"
        title="Próximos 14 dias"
        description={
          entries.length > 0
            ? `${entries.length} ${entries.length === 1 ? "item" : "itens"}`
            : undefined
        }
      />
      {days.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={<CalendarPlus />}
          title="Nada marcado nas próximas duas semanas"
          description="Cadastre gravações, reuniões e entregas para não perder nenhuma data."
          action={
            <ButtonLink href="/painel/agenda/novo" variant="secondary">
              Novo compromisso
            </ButtonLink>
          }
        />
      ) : (
        <ol className="space-y-4">
          {days.map((day) => (
            <li key={day.date}>
              <h3 className="text-grafite mb-1 text-sm font-bold">
                {capitalize(formatWeekday(day.date))},{" "}
                {formatDateShort(day.date)}
                {day.date === today ||
                formatRelativeDay(day.date, today) === "amanhã" ? (
                  <span className="text-roxo ml-2 font-semibold">
                    {formatRelativeDay(day.date, today)}
                  </span>
                ) : null}
              </h3>
              <ul className="divide-areia border-areia divide-y rounded-campo border">
                {day.entries.map((entry) => {
                  const tone: BadgeTone =
                    entry.source === "deadline"
                      ? "perigo"
                      : AGENDA_KIND_TONES[entry.kind];
                  return (
                    <li key={entry.key}>
                      <Link
                        href={entry.href}
                        className="hover:bg-lavanda-claro/50 flex min-h-12 items-start gap-3 px-3 py-2.5 focus-visible:outline-offset-[-2px]"
                      >
                        <span className="text-cinza w-[5.5rem] shrink-0 pt-px text-[0.8125rem] font-semibold tabular-nums">
                          {timeLabel(entry)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-grafite block text-sm font-semibold break-words">
                            {entry.source === "deadline" ? (
                              <>
                                <span aria-hidden="true">{DEADLINE_MARK} </span>
                                <span className="sr-only">
                                  Prazo do projeto:{" "}
                                </span>
                              </>
                            ) : null}
                            {entry.title}
                          </span>
                          <span className="text-cinza mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
                            <Badge tone={tone}>
                              {entry.source === "deadline"
                                ? entry.deadlineLabel
                                : AGENDA_KIND_LABELS[entry.kind]}
                            </Badge>
                            {entry.clientName ? (
                              <span>{entry.clientName}</span>
                            ) : null}
                            {entry.location && entry.source === "event" ? (
                              <span>{entry.location}</span>
                            ) : null}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
