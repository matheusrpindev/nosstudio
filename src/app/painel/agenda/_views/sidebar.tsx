"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/cn";
import { addMonths, formatDateLong, formatMonth, monthGrid, startOfMonth, startOfWeek, WEEKDAYS_SHORT, type ISODate } from "@/lib/dates";
import { AGENDA_DEFAULT_LAYERS, type AgendaColor, type AgendaIcon, type AgendaLayer } from "@/lib/domain";
import { CategoryIcon } from "../icons";
import { TONE_CLASS } from "../ui";
import { activeFilterCount, activeLayers, agendaHref, type AgendaState } from "../url";

export type SidebarCalendar = { id: number; name: string; color: AgendaColor; personal: boolean };
export type SidebarCategory = { id: number; name: string; color: AgendaColor; icon: AgendaIcon };
export type SidebarLayer = { id: AgendaLayer; label: string; color: AgendaColor; description: string };
type Option = { value: number; label: string };

export type SidebarProps = {
  state: AgendaState;
  today: ISODate;
  calendars: SidebarCalendar[];
  layers: SidebarLayer[];
  categories: SidebarCategory[];
  clients: Option[];
  people: Option[];
  /** Dias do mês do mini-calendário que têm algo marcado. */
  busyDays: ISODate[];
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Mini-calendário do mês: navega a agenda para o dia clicado (na visão anual, abre o dia). */
function MiniCalendar({ state, today, busyDays }: Pick<SidebarProps, "state" | "today" | "busyDays">) {
  const month = startOfMonth(state.date);
  const busy = new Set(busyDays);
  const selectedWeek = state.view === "semana" ? startOfWeek(state.date) : null;
  const go = (date: ISODate) => agendaHref(state, { date, view: state.view === "ano" ? "dia" : state.view }, today);
  return (
    <section aria-label={`Calendário de ${formatMonth(month)}`}>
      <div className="mb-1 flex items-center">
        <p className="text-texto flex-1 pl-1 text-sm font-bold">{capitalize(formatMonth(month))}</p>
        <Link href={agendaHref(state, { date: addMonths(month, -1) }, today)} scroll={false} aria-label="Mês anterior" className="btn btn-ghost btn-icon btn-sm text-texto-suave max-xl:size-11">
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Link>
        <Link href={agendaHref(state, { date: addMonths(month, 1) }, today)} scroll={false} aria-label="Próximo mês" className="btn btn-ghost btn-icon btn-sm text-texto-suave max-xl:size-11">
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <div className="text-texto-suave grid grid-cols-7 text-center text-[0.6875rem] font-semibold uppercase" aria-hidden="true">
        {WEEKDAYS_SHORT.map((name) => (
          <span key={name} className="py-1">
            {name.charAt(0)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(month).flat().map((day) => {
          const outside = day.slice(0, 7) !== month.slice(0, 7);
          const selected = day === state.date;
          const inWeek = selectedWeek !== null && startOfWeek(day) === selectedWeek;
          return (
            <Link
              key={day}
              href={go(day)}
              scroll={false}
              aria-label={`${formatDateLong(day)}${busy.has(day) ? " (com compromissos)" : ""}`}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "relative flex aspect-square min-h-8 items-center justify-center rounded-full text-[0.8125rem] font-medium tabular-nums max-xl:min-h-11",
                outside ? "text-texto-suave/60" : "text-texto",
                inWeek && !selected && "bg-superficie-alta rounded-none first:rounded-l-full",
                day === today && !selected && "text-primaria font-bold",
                selected ? "bg-primaria text-sobre-primaria font-bold" : "hover:bg-detalhe-suave",
              )}
            >
              {Number(day.slice(8))}
              {busy.has(day) && !selected ? <span aria-hidden="true" className="bg-detalhe absolute bottom-1 size-1 rounded-full max-xl:bottom-1.5" /> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Group({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="min-w-0">
      <div className="mb-1 flex min-h-8 items-center justify-between gap-2">
        <p id={id} className="text-texto-suave text-xs font-bold tracking-wide uppercase">
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function CheckRow({ id, label, tone, checked, onChange, hint, icon }: { id: string; label: string; tone: AgendaColor; checked: boolean; onChange: (checked: boolean) => void; hint?: string; icon?: ReactNode }) {
  return (
    <label htmlFor={id} title={hint} className="hover:bg-superficie-alta -mx-2 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 xl:min-h-9">
      <input id={id} type="checkbox" className={cn("agenda-caixa", TONE_CLASS[tone])} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {icon}
      <span className="text-texto min-w-0 flex-1 truncate text-sm">{label}</span>
    </label>
  );
}

/** Painel lateral: mini-calendário, agendas, camadas, categorias e filtros por cliente e responsável. */
export function Sidebar({ state: current, today, calendars, layers, categories, clients, people, busyDays }: SidebarProps) {
  const uid = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // a caixa marca na hora; a agenda chega em seguida (o estado de verdade continua sendo o da URL)
  const [state, setOptimistic] = useOptimistic(current);
  const go = (patch: Partial<AgendaState>) =>
    startTransition(() => {
      setOptimistic({ ...state, ...patch });
      router.push(agendaHref(state, patch, today), { scroll: false });
    });

  const allCalendarIds = calendars.map((calendar) => calendar.id);
  const shownCalendars = new Set(state.calendars ?? allCalendarIds);
  const toggleCalendar = (id: number, checked: boolean) => {
    const next = allCalendarIds.filter((item) => (item === id ? checked : shownCalendars.has(item)));
    go({ calendars: next.length === allCalendarIds.length ? null : next });
  };

  const allCategoryIds = categories.map((category) => category.id);
  const shownCategories = new Set(state.categories ?? allCategoryIds);
  const toggleCategory = (id: number, checked: boolean) => {
    const next = allCategoryIds.filter((item) => (item === id ? checked : shownCategories.has(item)));
    go({ categories: next.length === allCategoryIds.length ? null : next });
  };

  const shownLayers = activeLayers(state);
  const toggleLayer = (id: AgendaLayer, checked: boolean) => {
    const next = layers.map((layer) => layer.id).filter((item) => (item === id ? checked : shownLayers.includes(item)));
    const isDefault = next.length === AGENDA_DEFAULT_LAYERS.filter((layer) => layers.some((item) => item.id === layer)).length && next.every((layer) => AGENDA_DEFAULT_LAYERS.includes(layer));
    go({ layers: isDefault ? null : next });
  };

  const filtered = activeFilterCount(state) > 0 || state.layers !== null;

  return (
    <div className="space-y-5" aria-busy={pending || undefined}>
      <MiniCalendar state={current} today={today} busyDays={busyDays} />

      <Group
        title="Agendas"
        action={
          state.calendars ? (
            <button type="button" className="link text-xs" onClick={() => go({ calendars: null })}>
              Ver todas
            </button>
          ) : null
        }
      >
        {calendars.map((calendar) => (
          <CheckRow
            key={calendar.id}
            id={`${uid}-a-${calendar.id}`}
            label={calendar.name}
            tone={calendar.color}
            hint={calendar.personal ? "Agenda pessoal" : undefined}
            checked={shownCalendars.has(calendar.id)}
            onChange={(checked) => toggleCalendar(calendar.id, checked)}
          />
        ))}
      </Group>

      {layers.length > 0 ? (
        <Group title="Camadas">
          {layers.map((layer) => (
            <CheckRow
              key={layer.id}
              id={`${uid}-c-${layer.id}`}
              label={layer.label}
              tone={layer.color}
              hint={layer.description}
              checked={shownLayers.includes(layer.id)}
              onChange={(checked) => toggleLayer(layer.id, checked)}
            />
          ))}
          <p className="text-texto-suave mt-1 text-xs leading-snug">Somente leitura: vêm dos projetos, do conteúdo e do financeiro.</p>
        </Group>
      ) : null}

      <details className="group" open={state.categories !== null}>
        <summary className="text-texto-suave hover:text-texto flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold tracking-wide uppercase xl:min-h-8 [&::-webkit-details-marker]:hidden">
          <span>Categorias{state.categories ? ` (${state.categories.length} de ${categories.length})` : ""}</span>
          <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />
        </summary>
        <div role="group" aria-label="Categorias">
          {state.categories ? (
            <button type="button" className="link mb-1 text-xs" onClick={() => go({ categories: null })}>
              Ver todas
            </button>
          ) : (
            <button type="button" className="link mb-1 text-xs" onClick={() => go({ categories: [] })}>
              Desmarcar todas
            </button>
          )}
          {categories.map((category) => (
            <CheckRow
              key={category.id}
              id={`${uid}-k-${category.id}`}
              label={category.name}
              tone={category.color}
              icon={<CategoryIcon name={category.icon} className="text-texto-suave size-4 shrink-0" />}
              checked={shownCategories.has(category.id)}
              onChange={(checked) => toggleCategory(category.id, checked)}
            />
          ))}
        </div>
      </details>

      <div className="space-y-3">
        <div>
          <label htmlFor={`${uid}-cliente`} className="text-texto-suave mb-1 block text-xs font-bold tracking-wide uppercase">
            Cliente
          </label>
          <select id={`${uid}-cliente`} className="input" data-controlled="" value={state.clientId ?? ""} onChange={(event) => go({ clientId: Number(event.target.value) || null })}>
            <option value="">Todos os clientes</option>
            {clients.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-pessoa`} className="text-texto-suave mb-1 block text-xs font-bold tracking-wide uppercase">
            Responsável
          </label>
          <select id={`${uid}-pessoa`} className="input" data-controlled="" value={state.personId ?? ""} onChange={(event) => go({ personId: Number(event.target.value) || null })}>
            <option value="">Toda a equipe</option>
            {people.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {filtered || state.projectId ? (
          <Button variant="ghost" size="sm" className="-ml-3" onClick={() => go({ calendars: null, categories: null, layers: null, clientId: null, projectId: null, personId: null })}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** No celular e em telas médias o painel lateral vira gaveta, aberta pelo botão "Filtros". */
export function FiltersDrawer({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Drawer
      side="left"
      title="Agendas e filtros"
      trigger={
        <Button variant="secondary" icon={<SlidersHorizontal />} className="xl:hidden">
          Filtros
          {count > 0 ? <span className="bg-primaria text-sobre-primaria -mr-1 inline-flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-bold">{count}</span> : null}
        </Button>
      }
    >
      {children}
    </Drawer>
  );
}
