import { ChartGantt, ChevronLeft, ChevronRight, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ISODate } from "@/lib/dates";
import { AGENDA_CALENDAR_VIEWS, AGENDA_VIEW_LABELS, type AgendaView } from "@/lib/domain";
import { AGENDA_PATH, agendaHref, type AgendaState } from "../url";
import { ToolbarMenu } from "./toolbar-menu";

type Props = {
  state: AgendaState;
  today: ISODate;
  title: string;
  previous: ISODate;
  next: ISODate;
  canEdit: boolean;
  newHref: string;
  /** Botão "Filtros" (gaveta) das telas menores. */
  filters: ReactNode;
  /** Visões de planejamento que esta pessoa pode abrir (disponibilidade só para quem tem a agenda inteira). */
  planning: readonly AgendaView[];
  /** Links de exportação .ics (ausentes para quem não pode baixar). */
  exportHrefs: { screen: string; year: string } | null;
  configHref: string | null;
  /** Resumo dos filtros ligados — aparece só na impressão, abaixo do título. */
  printNote?: string;
};

const PERIOD: Record<AgendaState["view"], string> = { dia: "dia", semana: "semana", mes: "mês", ano: "ano", lista: "período", disponibilidade: "período", linha: "período" };
const PLANNING_ICON = { disponibilidade: Users, linha: ChartGantt } as const;

/** Campos ocultos que preservam os filtros quando a busca é enviada. */
function preserved(state: AgendaState): [string, string][] {
  const url = new URL(agendaHref({ ...state, view: "lista", q: "" }), "http://x");
  return [...url.searchParams.entries()].filter(([key]) => key !== "vista");
}

/** Barra da agenda: Hoje, anterior/próximo, título do período, visões, busca, "Novo compromisso" e "Mais ações". */
export function Toolbar({ state, today, title, previous, next, canEdit, newHref, filters, planning, exportHrefs, configHref, printNote }: Props) {
  const viewLink = (view: AgendaView) => agendaHref(state, { view, q: view === "lista" ? state.q : "" }, today);
  return (
    <header className="mb-4 space-y-3 print:mb-3">
      <div className="flex items-center gap-2">
        <h1 className="text-texto text-2xl leading-tight font-extrabold tracking-tight sm:text-[1.75rem] print:text-xl">Agenda</h1>
        <div className="ml-auto flex items-center gap-2 print:hidden">
          <ToolbarMenu exportHrefs={exportHrefs} configHref={configHref} />
          {canEdit ? (
            <ButtonLink href={newHref} icon={<Plus />}>
              Novo compromisso
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="flex min-w-0 items-center gap-1 max-sm:w-full">
          <ButtonLink href={agendaHref(state, { date: today }, today)} variant="secondary" aria-current={state.date === today ? "date" : undefined} className="print:hidden">
            Hoje
          </ButtonLink>
          <Link href={agendaHref(state, { date: previous }, today)} aria-label={`Anterior (${PERIOD[state.view]})`} title="Anterior" className="btn btn-ghost btn-icon print:hidden">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <Link href={agendaHref(state, { date: next }, today)} aria-label={`Próximo (${PERIOD[state.view]})`} title="Próximo" className="btn btn-ghost btn-icon print:hidden">
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
          <h2 aria-live="polite" className="text-texto ml-1 min-w-0 truncate text-lg font-bold sm:text-xl print:ml-0 print:text-base">
            {title}
          </h2>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 max-sm:w-full print:hidden">
          <form action={AGENDA_PATH} method="get" role="search" className="relative max-xl:hidden">
            <input type="hidden" name="vista" value="lista" />
            {preserved(state).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <Search aria-hidden="true" className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-[1.125rem] -translate-y-1/2" />
            <input type="search" name="q" defaultValue={state.q} aria-label="Buscar compromissos" placeholder="Buscar…" enterKeyHint="search" className="input w-44 pl-10 2xl:w-52" />
          </form>
          <nav aria-label="Visão da agenda" className="flex items-center gap-2 max-sm:w-full">
            <div className="border-borda-forte flex rounded-campo border bg-superficie p-0.5 max-sm:flex-1">
              {AGENDA_CALENDAR_VIEWS.map((view) => (
                <Link
                  key={view}
                  href={viewLink(view)}
                  aria-current={state.view === view ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 flex-1 items-center justify-center rounded-[0.5rem] px-3 text-sm font-semibold whitespace-nowrap transition-colors max-sm:px-1.5",
                    state.view === view ? "bg-detalhe-suave text-detalhe" : "text-texto-suave hover:text-texto",
                  )}
                >
                  {AGENDA_VIEW_LABELS[view]}
                </Link>
              ))}
            </div>
            {planning.length > 0 ? (
              <div className="border-borda-forte flex rounded-campo border bg-superficie p-0.5">
                {planning.map((view) => {
                  const Icon = PLANNING_ICON[view as keyof typeof PLANNING_ICON];
                  return (
                    <Link
                      key={view}
                      href={viewLink(view)}
                      aria-current={state.view === view ? "page" : undefined}
                      aria-label={AGENDA_VIEW_LABELS[view]}
                      title={AGENDA_VIEW_LABELS[view]}
                      className={cn(
                        "flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-[0.5rem] px-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
                        state.view === view ? "bg-detalhe-suave text-detalhe" : "text-texto-suave hover:text-texto",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
                      <span className="max-2xl:hidden">{AGENDA_VIEW_LABELS[view]}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </nav>
          {filters}
        </div>
      </div>
      {printNote ? <p className="text-texto-suave hidden text-xs print:block">{printNote}</p> : null}
    </header>
  );
}

/** Busca no topo da visão Lista (visível em qualquer largura). */
export function ListSearch({ state }: { state: AgendaState }) {
  return (
    <form action={AGENDA_PATH} method="get" role="search" className="mb-4 flex gap-2">
      <input type="hidden" name="vista" value="lista" />
      {preserved(state).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="relative flex-1">
        <Search aria-hidden="true" className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-[1.125rem] -translate-y-1/2" />
        <input type="search" name="q" defaultValue={state.q} aria-label="Buscar compromissos" placeholder="Buscar por título, cliente, local, pessoa…" enterKeyHint="search" className="input pl-10" />
      </div>
      <button type="submit" className="btn btn-secondary">
        Buscar
      </button>
      {state.q ? (
        <Link href={agendaHref(state, { q: "" })} className="btn btn-ghost">
          Limpar
        </Link>
      ) : null}
    </form>
  );
}
