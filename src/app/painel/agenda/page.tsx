import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  MonthCalendar,
  parseMonthParam,
  type CalendarItem,
} from "@/components/ui/month-calendar";
import { PageHeader } from "@/components/ui/page-header";
import {
  paramId,
  paramOneOf,
  type PageSearchParams,
} from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { addDays, endOfMonth, formatDate, todayISO } from "@/lib/dates";
import { AGENDA_KIND_LABELS, AGENDA_KINDS } from "@/lib/domain";
import { listAgenda } from "@/server/agenda/admin";
import { upcomingEnd, type AgendaEntry } from "@/server/agenda/logic";
import { getUserOptions } from "@/server/options";
import { AGENDA_KIND_TONES, DEADLINE_MARK, DEADLINE_TONE } from "./ui";
import { Upcoming } from "./upcoming";

export const metadata: Metadata = { title: "Agenda" };
export const instant = false;

function toItem(entry: AgendaEntry): CalendarItem {
  if (entry.source === "deadline") {
    // prazos do projeto: somente leitura, em vermelho e com o losango (não depende só da cor)
    return {
      id: entry.key,
      date: entry.date,
      title: `${DEADLINE_MARK} ${entry.deadlineLabel}: ${entry.title}`,
      tone: DEADLINE_TONE,
      href: entry.href,
    };
  }
  return {
    id: entry.key,
    date: entry.date,
    time: entry.startTime,
    title: entry.title,
    tone: AGENDA_KIND_TONES[entry.kind],
    href: entry.href,
  };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const month = parseMonthParam(params.mes, today);
  const users = await getUserOptions();
  // a URL é entrada do usuário: só vale responsável que existe e tipo que está no enum
  const ownerId = paramId(params.responsavel);
  const filters = {
    ownerId: users.some((u) => u.value === ownerId) ? ownerId : undefined,
    kind: paramOneOf(AGENDA_KINDS, params.tipo),
  };

  // A grade mostra dias dos meses vizinhos: busca uma semana a mais de cada lado.
  const [monthEntries, upcoming] = await Promise.all([
    listAgenda(addDays(month, -7), addDays(endOfMonth(month), 7), filters),
    listAgenda(today, upcomingEnd(today, 14), filters),
  ]);

  const baseQuery = new URLSearchParams();
  if (filters.ownerId) baseQuery.set("responsavel", String(filters.ownerId));
  if (filters.kind) baseQuery.set("tipo", filters.kind);
  const baseHref = `/painel/agenda${baseQuery.size > 0 ? `?${baseQuery}` : ""}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Gravações, reuniões, eventos e entregas. Os prazos dos projetos aparecem em vermelho, só para consulta."
        actions={
          <ButtonLink href="/painel/agenda/novo" icon={<Plus />}>
            Novo compromisso
          </ButtonLink>
        }
      />

      <FilterBar
        search={false}
        preserve={["mes"]}
        filters={[
          {
            name: "responsavel",
            label: "Responsável",
            options: users,
            allLabel: "Toda a equipe",
          },
          {
            name: "tipo",
            label: "Tipo",
            options: AGENDA_KIND_LABELS,
            allLabel: "Todos os tipos",
          },
        ]}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* No celular, "Próximos 14 dias" vem antes do calendário (é o que se consulta mais). */}
        <div className="min-w-0 max-sm:order-2">
          <MonthCalendar
            month={month}
            today={today}
            items={monthEntries.map(toItem)}
            baseHref={baseHref}
            label="Agenda"
            daySlot={(date) => (
              <Link
                href={`/painel/agenda/novo?data=${date}`}
                aria-label={`Novo compromisso em ${formatDate(date)}`}
                title="Novo compromisso neste dia"
                className="text-detalhe hover:bg-detalhe-suave pointer-coarse:opacity-100 inline-flex size-11 items-center justify-center rounded-full sm:size-7 sm:opacity-0 sm:group-hover/dia:opacity-100 sm:focus-visible:opacity-100"
              >
                <Plus aria-hidden="true" className="size-5 sm:size-4" />
              </Link>
            )}
          />
          <ul aria-label="Legenda" className="mt-3 flex flex-wrap gap-2">
            {AGENDA_KINDS.map((kind) => (
              <li key={kind}>
                <Badge tone={AGENDA_KIND_TONES[kind]} dot>
                  {AGENDA_KIND_LABELS[kind]}
                </Badge>
              </li>
            ))}
            <li>
              <Badge tone={DEADLINE_TONE}>
                <span aria-hidden="true">{DEADLINE_MARK}</span> Prazo de projeto
              </Badge>
            </li>
          </ul>
        </div>
        <div className="min-w-0 max-sm:order-1">
          <Upcoming entries={upcoming} today={today} />
        </div>
      </div>
    </>
  );
}
