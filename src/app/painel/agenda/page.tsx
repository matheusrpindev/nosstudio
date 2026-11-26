import type { Metadata } from "next";
import type { PageSearchParams } from "@/components/ui/search-params";
import { requirePermission, canEverywhere } from "@/lib/auth";
import { viewRange } from "@/lib/agenda/view";
import { addDays, endOfMonth, startOfMonth, startOfWeek, todayISO, type ISODate } from "@/lib/dates";
import { AGENDA_DEFAULT_CATEGORY_SLUG } from "@/lib/domain";
import { getAvailableLayers } from "@/server/agenda/layers";
import { listAgenda, listCalendars, listCategories } from "@/server/agenda/queries";
import { usersWithoutCalendar } from "@/server/agenda/settings";
import { getClientOptions, getUserOptions } from "@/server/options";
import { EnsureCalendars } from "./_views/ensure-calendars";
import { ListView } from "./_views/list-view";
import { MonthView } from "./_views/month-view";
import { QuickCreateProvider } from "./_views/quick-create";
import { FiltersDrawer, Sidebar, type SidebarProps } from "./_views/sidebar";
import { TimeGrid } from "./_views/time-grid";
import { ListSearch, Toolbar } from "./_views/toolbar";
import { YearView } from "./_views/year-view";
import { activeFilterCount, activeLayers, AGENDA_PATH, agendaHref, parseAgendaState } from "./url";

export const metadata: Metadata = { title: "Agenda" };
export const instant = false;

/** Com busca, a lista olha de seis meses atrás até um ano à frente da data-âncora. */
const SEARCH_BACK_DAYS = 183;
const SEARCH_AHEAD_DAYS = 365;

export default async function AgendaPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requirePermission("agenda", "ver");
  const today = todayISO();
  const raw = parseAgendaState(await searchParams, today);
  const canEdit = canEverywhere(user, "agenda", "editar");

  const [calendars, categories, layers, clients, people, missingCalendars] = await Promise.all([
    listCalendars(),
    listCategories(),
    getAvailableLayers(user),
    getClientOptions(),
    getUserOptions(),
    canEdit ? usersWithoutCalendar() : Promise.resolve([]),
  ]);

  // a URL é entrada do usuário: só valem ids que existem (e camadas que a pessoa pode ver)
  const known = <T extends { id: number }>(ids: number[] | null, rows: T[]) => (ids === null ? null : ids.filter((id) => rows.some((row) => row.id === id)));
  const state = {
    ...raw,
    calendars: known(raw.calendars, calendars),
    categories: known(raw.categories, categories),
    layers: raw.layers === null ? null : raw.layers.filter((layer) => layers.some((item) => item.id === layer)),
    clientId: clients.some((option) => option.value === raw.clientId) ? raw.clientId : null,
    personId: people.some((option) => option.value === raw.personId) ? raw.personId : null,
  };

  const range = viewRange(state.view, state.date);
  const searching = state.view === "lista" && state.q !== "";
  const from = searching ? addDays(state.date, -SEARCH_BACK_DAYS) : range.from;
  const to = searching ? addDays(state.date, SEARCH_AHEAD_DAYS) : range.to;
  const filters = {
    // só as agendas ativas: compromissos de uma agenda desativada saem da tela
    calendarIds: state.calendars ?? calendars.map((calendar) => calendar.id),
    categoryIds: state.categories,
    clientId: state.clientId,
    projectId: state.projectId,
    personId: state.personId,
    q: state.view === "lista" ? state.q : "",
    layers: activeLayers(state).filter((layer) => layers.some((item) => item.id === layer)),
  };

  // o mini-calendário marca os dias com algo: reaproveita a consulta quando a janela já cobre o mês
  const miniFrom = startOfWeek(startOfMonth(state.date));
  const miniTo = addDays(startOfWeek(endOfMonth(state.date)), 6);
  const covers = from <= miniFrom && to >= miniTo;
  const [items, miniItems] = await Promise.all([
    listAgenda(user, from, to, filters),
    covers ? Promise.resolve(null) : listAgenda(user, miniFrom, miniTo, { ...filters, q: "" }),
  ]);
  const busyDays = new Set<ISODate>();
  for (const item of miniItems ?? items) {
    for (let day = item.date; day <= item.endDate && day <= miniTo; day = addDays(day, 1)) if (day >= miniFrom) busyDays.add(day);
  }

  const here = agendaHref(state, {}, today);
  const newHref = `${AGENDA_PATH}/novo?data=${state.date}&voltar=${encodeURIComponent(here)}`;
  const dayHref = (day: ISODate) => agendaHref(state, { view: "dia", date: day, q: "" }, today);
  const allDays: ISODate[] = [];
  if (state.view === "mes" || state.view === "semana" || state.view === "dia") for (let day = range.from; day <= range.to; day = addDays(day, 1)) allDays.push(day);
  const dayHrefs = Object.fromEntries(allDays.map((day) => [day, dayHref(day)]));

  const personalIds = new Set(calendars.filter((calendar) => calendar.kind === "pessoal").map((calendar) => calendar.id));
  const sidebar: SidebarProps = {
    state,
    today,
    calendars: calendars.map((calendar) => ({ id: calendar.id, name: calendar.name, color: calendar.color, personal: personalIds.has(calendar.id) })),
    layers,
    categories: categories.map((category) => ({ id: category.id, name: category.name, color: category.color, icon: category.icon })),
    clients,
    people,
    busyDays: [...busyDays],
  };
  // agendas em que dá para criar pela criação rápida: a pessoal de quem está usando vem primeiro
  const ownCalendar = calendars.find((calendar) => calendar.userId === user.id);
  const creatable = calendars.filter((calendar) => calendar.kind !== "pessoal" || calendar.userId === user.id);

  return (
    <QuickCreateProvider
      enabled={canEdit}
      categories={categories.map((category) => ({ value: category.id, label: category.name }))}
      calendars={creatable.map((calendar) => ({ value: calendar.id, label: calendar.kind === "pessoal" ? `${calendar.name} (pessoal)` : calendar.name }))}
      defaultCategoryId={categories.find((category) => category.slug === AGENDA_DEFAULT_CATEGORY_SLUG)?.id ?? categories[0]?.id ?? null}
      defaultCalendarId={calendars.find((calendar) => calendar.kind === "geral")?.id ?? ownCalendar?.id ?? calendars[0]?.id ?? null}
      returnTo={here}
    >
      {missingCalendars.length > 0 ? <EnsureCalendars /> : null}
      <Toolbar
        state={state}
        today={today}
        title={searching ? `Busca: “${state.q}”` : range.title}
        previous={range.previous}
        next={range.next}
        canEdit={canEdit}
        newHref={newHref}
        filters={
          <FiltersDrawer count={activeFilterCount(state) + (state.layers !== null ? 1 : 0)}>
            <Sidebar {...sidebar} />
          </FiltersDrawer>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[14.5rem_minmax(0,1fr)]">
        <aside aria-label="Agendas e filtros" className="max-xl:hidden">
          <Sidebar {...sidebar} />
        </aside>
        <div className="min-w-0">
          {state.view === "dia" || state.view === "semana" ? (
            <TimeGrid days={range.days} items={items} today={today} selected={state.date} dayHrefs={dayHrefs} />
          ) : state.view === "mes" ? (
            <MonthView
              month={startOfMonth(state.date)}
              today={today}
              selected={state.date}
              items={items}
              dayHrefs={dayHrefs}
              selectHrefs={Object.fromEntries(allDays.map((day) => [day, agendaHref(state, { date: day }, today)]))}
              newHref={`${AGENDA_PATH}/novo?voltar=${encodeURIComponent(here)}`}
            />
          ) : state.view === "ano" ? (
            <YearView
              year={Number(state.date.slice(0, 4))}
              today={today}
              items={items}
              dayHref={dayHref}
              monthHref={(month) => agendaHref(state, { view: "mes", date: month }, today)}
            />
          ) : (
            <>
              <ListSearch state={state} />
              <ListView from={from} to={to} today={today} items={items} q={state.q} newHref={newHref} canEdit={canEdit} />
            </>
          )}
        </div>
      </div>
    </QuickCreateProvider>
  );
}
