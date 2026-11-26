import { CalendarDays, Clapperboard, MapPin } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { diffDays, formatDateShort, formatWeekday, type ISODate } from "@/lib/dates";
import { groupByDay } from "@/server/dashboard/logic";
import type { DashboardEvent } from "@/server/dashboard/queries";
import { AgendaItemCategory, AgendaItemTitle, agendaDayHref } from "../_shared/agenda-item";

function dayLabel(date: ISODate, today: ISODate) {
  const diff = diffDays(today, date);
  const weekday = formatWeekday(date);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function timeLabel(event: DashboardEvent) {
  if (!event.startTime) return "Dia todo";
  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
}

/** "até 28 nov" em compromisso de vários dias. */
const untilLabel = (event: DashboardEvent) => (event.endDate > event.date ? `até ${formatDateShort(event.endDate)}` : null);

const rowClass = "hover:bg-detalhe-suave/60 focus-visible:bg-detalhe-suave/60 -mx-2 flex min-h-11 items-start gap-3 rounded-campo px-2 py-2 transition-colors";

function EventLine({ event }: { event: DashboardEvent }) {
  const until = untilLabel(event);
  return (
    <Link href={event.href} className={rowClass} data-ocupado={event.masked ? "" : undefined}>
      <span className="text-detalhe w-[4.25rem] shrink-0 pt-0.5 text-[0.8125rem] leading-tight font-bold tabular-nums">{timeLabel(event)}</span>
      <span className="min-w-0 flex-1">
        <AgendaItemTitle item={event} className="text-texto text-[0.9375rem] leading-snug font-semibold" />
        <span className="text-texto-suave mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
          <AgendaItemCategory item={event} />
          {until ? <span>{until}</span> : null}
          {event.clientName ? <span className="break-words">{event.clientName}</span> : null}
          {event.location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="break-words">{event.location}</span>
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

/** Compromissos dos próximos 7 dias, agrupados por dia (o que começou antes e ainda continua entra em "Hoje"). */
export function WeekAgenda({ events, today, canCreate }: { events: DashboardEvent[]; today: ISODate; canCreate: boolean }) {
  const groups = groupByDay(events.map((event) => ({ event, date: event.date < today ? today : event.date })));
  return (
    <Card flush as="section" aria-labelledby="semana-titulo">
      <CardHeader
        id="semana-titulo"
        title="Compromissos da semana"
        description="Hoje e os próximos 6 dias."
        action={
          <ButtonLink href="/painel/agenda" variant="ghost" size="sm">
            Abrir agenda
          </ButtonLink>
        }
      />
      <div className="card-secao">
        {groups.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<CalendarDays />}
            title="Nenhum compromisso nos próximos 7 dias"
            description="Semana livre por enquanto. Quando marcar uma gravação, reunião ou entrega, ela aparece aqui."
            action={
              canCreate ? (
                <ButtonLink href="/painel/agenda/novo" variant="secondary" size="sm">
                  Novo compromisso
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.date}>
                <h3 className="text-texto-suave mb-1 text-xs font-bold tracking-[0.1em] uppercase">
                  <Link href={agendaDayHref(group.date)} className="hover:text-detalhe -my-2 inline-flex min-h-11 items-center gap-1 sm:min-h-0 sm:py-1">
                    {dayLabel(group.date, today)} <span className="font-semibold tracking-normal normal-case">· {formatDateShort(group.date)}</span>
                  </Link>
                </h3>
                <ul className="divide-borda divide-y">
                  {group.items.map(({ event }) => (
                    <li key={event.key}>
                      <EventLine event={event} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Gravações, sessões, eventos e casamentos (categorias de produção) dos próximos 30 dias. */
export function UpcomingShoots({ events, today }: { events: DashboardEvent[]; today: ISODate }) {
  return (
    <Card flush as="section" aria-labelledby="gravacoes-titulo">
      <CardHeader id="gravacoes-titulo" title="Próximas gravações e eventos" description="Nos próximos 30 dias." />
      <div className="card-secao">
        {events.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={<Clapperboard />}
            title="Nenhuma gravação ou evento nos próximos 30 dias"
            description="Cadastre na agenda para não esquecer o equipamento nem o deslocamento."
          />
        ) : (
          <ul className="divide-borda divide-y">
            {events.map((event) => {
              const day = event.date < today ? today : event.date;
              return (
                <li key={event.key}>
                  <Link href={event.href} className={rowClass}>
                    <span className="bg-detalhe-suave text-detalhe w-14 shrink-0 rounded-campo px-1 py-1.5 text-center leading-none">
                      <span className="block text-base font-extrabold tabular-nums">{event.date.slice(8, 10)}</span>
                      <span className="mt-0.5 block text-[0.6875rem] font-bold uppercase">{formatDateShort(event.date).split(" ")[1]}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <AgendaItemTitle item={event} className="text-texto text-[0.9375rem] leading-snug font-semibold" />
                      <span className="text-texto-suave mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
                        <AgendaItemCategory item={event} />
                        <span>
                          {event.date < today ? "Em andamento" : dayLabel(day, today)}
                          {event.startTime ? `, ${event.startTime}` : ""}
                        </span>
                        {event.clientName ? <span className="break-words">· {event.clientName}</span> : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
