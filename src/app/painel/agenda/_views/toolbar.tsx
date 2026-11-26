import { ChevronLeft, ChevronRight, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ISODate } from "@/lib/dates";
import { AGENDA_VIEW_LABELS, AGENDA_VIEWS } from "@/lib/domain";
import { AGENDA_PATH, agendaHref, type AgendaState } from "../url";

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
};

const PERIOD: Record<AgendaState["view"], string> = { dia: "dia", semana: "semana", mes: "mês", ano: "ano", lista: "período" };

/** Campos ocultos que preservam os filtros quando a busca é enviada. */
function preserved(state: AgendaState): [string, string][] {
  const url = new URL(agendaHref({ ...state, view: "lista", q: "" }), "http://x");
  return [...url.searchParams.entries()].filter(([key]) => key !== "vista");
}

/** Barra da agenda: Hoje, anterior/próximo, título do período, visões, busca e "Novo compromisso". */
export function Toolbar({ state, today, title, previous, next, canEdit, newHref, filters }: Props) {
  return (
    <header className="mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-texto text-2xl leading-tight font-extrabold tracking-tight sm:text-[1.75rem]">Agenda</h1>
        <div className="ml-auto flex items-center gap-2">
          {canEdit ? (
            <Link href={`${AGENDA_PATH}/config`} aria-label="Configurar categorias, agendas e modelos" title="Configurar categorias, agendas e modelos" className="btn btn-ghost btn-icon text-texto-suave">
              <Settings aria-hidden="true" className="size-5" />
            </Link>
          ) : null}
          {canEdit ? (
            <ButtonLink href={newHref} icon={<Plus />}>
              Novo compromisso
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="flex min-w-0 items-center gap-1 max-sm:w-full">
          <ButtonLink href={agendaHref(state, { date: today }, today)} variant="secondary" aria-current={state.date === today ? "date" : undefined}>
            Hoje
          </ButtonLink>
          <Link href={agendaHref(state, { date: previous }, today)} aria-label={`Anterior (${PERIOD[state.view]})`} title="Anterior" className="btn btn-ghost btn-icon">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <Link href={agendaHref(state, { date: next }, today)} aria-label={`Próximo (${PERIOD[state.view]})`} title="Próximo" className="btn btn-ghost btn-icon">
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
          <h2 aria-live="polite" className="text-texto ml-1 min-w-0 truncate text-lg font-bold sm:text-xl">
            {title}
          </h2>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 max-sm:w-full">
          <form action={AGENDA_PATH} method="get" role="search" className="relative max-lg:hidden">
            <input type="hidden" name="vista" value="lista" />
            {preserved(state).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <Search aria-hidden="true" className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-[1.125rem] -translate-y-1/2" />
            <input type="search" name="q" defaultValue={state.q} aria-label="Buscar compromissos" placeholder="Buscar…" enterKeyHint="search" className="input w-44 pl-10 xl:w-52" />
          </form>
          <nav aria-label="Visão da agenda" className="border-borda-forte flex rounded-campo border bg-superficie p-0.5 max-sm:flex-1">
            {AGENDA_VIEWS.map((view) => (
              <Link
                key={view}
                href={agendaHref(state, { view, q: view === "lista" ? state.q : "" }, today)}
                aria-current={state.view === view ? "page" : undefined}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center rounded-[0.5rem] px-3 text-sm font-semibold whitespace-nowrap transition-colors max-sm:px-1.5",
                  state.view === view ? "bg-detalhe-suave text-detalhe" : "text-texto-suave hover:text-texto",
                )}
              >
                {AGENDA_VIEW_LABELS[view]}
              </Link>
            ))}
          </nav>
          {filters}
        </div>
      </div>
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
