import { CalendarPlus, Check, Lock, UserRoundX } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { barSegment, suggestSlot } from "@/lib/agenda/availability";
import { timeToMinutes, type FreeWindow } from "@/lib/agenda/conflicts";
import { cn } from "@/lib/cn";
import { formatDateLong, formatWeekday, type ISODate } from "@/lib/dates";
import type { Availability, AvailabilityBlock, AvailabilityDay } from "@/server/agenda/availability";
import { TONE_CLASS } from "../ui";
import { AGENDA_PATH, type AgendaState, type AvailabilityMode } from "../url";
import { BlockPeriod } from "./block-period";

type Props = {
  availability: Availability;
  /** Todas as pessoas que podem entrar na consulta (as selecionadas estão em `availability.people`). */
  everyone: { id: number; name: string }[];
  state: AgendaState;
  today: ISODate;
  userId: number;
  canEdit: boolean;
  returnTo: string;
  /** Link que liga/desliga cada pessoa. */
  personHrefs: Record<number, string>;
  modeHrefs: Record<AvailabilityMode, string>;
  /** Link que abre cada dia no modo "dia". */
  dayHrefs: Record<ISODate, string>;
};

const firstName = (name: string) => name.split(" ")[0];
const range = (block: Pick<AvailabilityBlock, "startTime" | "endTime">) => (block.startTime ? `${block.startTime}${block.endTime ? ` – ${block.endTime}` : ""}` : "dia inteiro");

/** Link "marcar neste horário": abre a criação já com a data, o horário e as pessoas selecionadas. */
function bookHref(day: ISODate, window: FreeWindow, people: number[], returnTo: string): string {
  const slot = suggestSlot(window);
  const params = new URLSearchParams({ data: day, inicio: slot.start, fim: slot.end, pessoas: people.join("-"), voltar: returnTo });
  return `${AGENDA_PATH}/novo?${params}`;
}

function busySummary(blocks: AvailabilityBlock[]): string {
  if (blocks.length === 0) return "livre";
  if (blocks.some((block) => block.wholeDay)) return `indisponível o dia inteiro (${blocks.find((block) => block.wholeDay)?.title})`;
  return `ocupada ${blocks.map(range).join(", ")}`;
}

/**
 * Disponibilidade da equipe. Um dia: uma coluna por pessoa (o que a ocupa, hora a hora) e, à esquerda, as
 * janelas em que todas as pessoas selecionadas estão livres. A semana: uma linha por pessoa com a ocupação de
 * cada dia no expediente e, no topo, as janelas em comum. Particular de outra pessoa aparece como "Ocupado".
 */
export function AvailabilityView({ availability, everyone, state, today, userId, canEdit, returnTo, personHrefs, modeHrefs, dayHrefs }: Props) {
  const { people, days, workday } = availability;
  const selected = people.map((person) => person.id);
  const blockable = canEdit ? everyone.map((person) => ({ value: person.id, label: person.name })) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 print:hidden">
        <nav aria-label="Período da disponibilidade" className="border-borda-forte flex shrink-0 rounded-campo border bg-superficie p-0.5">
          {(["dia", "semana"] as const).map((mode) => (
            <Link
              key={mode}
              href={modeHrefs[mode]}
              aria-current={state.mode === mode ? "page" : undefined}
              className={cn("flex min-h-10 items-center justify-center rounded-[0.5rem] px-4 text-sm font-semibold transition-colors", state.mode === mode ? "bg-detalhe-suave text-detalhe" : "text-texto-suave hover:text-texto")}
            >
              {mode === "dia" ? "Um dia" : "Semana"}
            </Link>
          ))}
        </nav>
        <ul aria-label="Pessoas na consulta" className="flex min-w-0 flex-1 flex-wrap gap-2 max-sm:order-last max-sm:w-full max-sm:flex-none">
          {everyone.map((person) => {
            const on = selected.includes(person.id);
            return (
              <li key={person.id}>
                <Link
                  href={personHrefs[person.id] ?? "#"}
                  scroll={false}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1.5 text-sm font-semibold transition-colors",
                    on ? "border-detalhe-medio bg-detalhe-suave text-texto" : "border-borda-forte text-texto-suave hover:text-texto",
                  )}
                >
                  <Avatar name={person.name} size="sm" tone={on ? "lima" : "lavanda"} className={on ? undefined : "opacity-60"} />
                  {firstName(person.name)}
                  {on ? <Check aria-hidden="true" className="text-detalhe size-4" /> : null}
                  <span className="sr-only">{on ? "(na consulta — tirar)" : "(fora da consulta — incluir)"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {blockable.length > 0 ? <BlockPeriod people={blockable} defaultPersonId={blockable.some((person) => person.value === userId) ? userId : blockable[0].value} defaultDate={state.date} /> : null}
      </div>

      {people.length === 0 ? (
        <EmptyState icon={<UserRoundX />} title="Ninguém selecionado" description="Escolha ao menos uma pessoa acima para ver a ocupação e as janelas livres." />
      ) : state.mode === "dia" ? (
        <DayColumns day={days[0]} people={people} workday={workday} today={today} selected={selected} canEdit={canEdit} returnTo={returnTo} />
      ) : (
        <WeekRows days={days} people={people} workday={workday} today={today} selected={selected} canEdit={canEdit} returnTo={returnTo} dayHrefs={dayHrefs} />
      )}

      <p className="text-texto-suave text-xs leading-relaxed">
        Expediente considerado: {workday.start} às {workday.end}. Compromissos cancelados não contam; “a confirmar” contam. Compromisso particular de outra pessoa aparece só como “Ocupado”.
        {people.length > 1 ? " As janelas “em comum” são os horários em que todas as pessoas selecionadas estão livres." : ""}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- um dia
type ViewProps = { people: Availability["people"]; workday: Availability["workday"]; today: ISODate; selected: number[]; canEdit: boolean; returnTo: string };

function DayColumns({ day, people, workday, today, selected, canEdit, returnTo }: ViewProps & { day: AvailabilityDay }) {
  // a grade mostra o expediente com uma hora de folga de cada lado
  const firstHour = Math.max(0, Math.floor(timeToMinutes(workday.start) / 60) - 1);
  const lastHour = Math.min(24, Math.ceil(timeToMinutes(workday.end) / 60) + 1);
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const from = firstHour * 60;
  const to = lastHour * 60;
  /** Posição de um intervalo na coluna (cortado na janela mostrada); `null` se fica todo de fora. */
  const box = (startTime: string | null, endTime: string | null): CSSProperties | null => {
    const start = Math.max(from, startTime ? timeToMinutes(startTime) : from);
    const end = Math.min(to, startTime ? (endTime ? timeToMinutes(endTime) : timeToMinutes(startTime) + 60) : to);
    if (end <= start) return null;
    return { top: `calc(var(--agenda-hora) * ${(start - from) / 60} + 1px)`, height: `calc(var(--agenda-hora) * ${(end - start) / 60} - 2px)` };
  };
  const shade = (startMin: number, endMin: number): CSSProperties => ({ top: `calc(var(--agenda-hora) * ${(startMin - from) / 60})`, height: `calc(var(--agenda-hora) * ${(endMin - startMin) / 60})` });
  const columns = people.length + 1;
  const title = `${formatWeekday(day.date)}, ${formatDateLong(day.date)}`;

  return (
    <div className="card agenda-impressao overflow-hidden">
      <div tabIndex={0} role="group" aria-label={`Disponibilidade em ${title}`} className="agenda-rolagem relative overflow-x-auto outline-offset-[-2px]">
        <div className="agenda-grade" style={{ "--agenda-dias": columns, gridTemplateColumns: `var(--agenda-regua) repeat(${columns}, minmax(8.75rem, 1fr))` } as CSSProperties}>
          <div className="agenda-grade-topo border-borda border-b bg-superficie">
            <div className="border-borda sticky left-0 z-10 border-r bg-superficie" />
            <div className="border-borda border-r px-2 py-2.5">
              <p className="text-primaria text-sm font-bold">Livre em comum</p>
              <p className="text-texto-suave text-xs">{people.length === 1 ? "desta pessoa" : `das ${people.length} pessoas`}</p>
            </div>
            {people.map((person) => {
              const entry = day.people[person.id];
              const off = entry.busy.filter((block) => block.wholeDay);
              return (
                <div key={person.id} className="border-borda min-w-0 border-r px-2 py-2.5 last:border-r-0">
                  <p className="text-texto flex items-center gap-2 text-sm font-bold">
                    <Avatar name={person.name} size="sm" />
                    <span className="truncate">{firstName(person.name)}</span>
                  </p>
                  {off.map((block) => (
                    <Link key={block.key} href={block.href} data-ocupado="" className="agenda-evento mt-1.5 flex min-h-6 items-center gap-1 px-2 py-0.5 text-xs font-semibold" title={`Indisponível o dia inteiro: ${block.title}`}>
                      {block.masked ? <Lock aria-hidden="true" className="size-3 shrink-0" /> : null}
                      <span className="truncate">{block.title}</span>
                    </Link>
                  ))}
                  {entry.notes.map((block) => (
                    <Link key={block.key} href={block.href} data-camada="" className={cn("agenda-evento mt-1.5 flex min-h-6 items-center px-2 py-0.5 text-xs", TONE_CLASS[block.color])} title={`${block.title} (dia inteiro, não ocupa)`}>
                      <span className="truncate">{block.title}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="agenda-grade-topo">
            <div className="border-borda sticky left-0 z-10 border-r bg-superficie" aria-hidden="true">
              {hours.map((hour, index) => (
                <div key={hour} className="text-texto-suave relative h-[var(--agenda-hora)] pr-1.5 text-right text-[0.6875rem] font-medium tabular-nums">
                  {index > 0 ? <span className="relative -top-2">{String(hour).padStart(2, "0")}:00</span> : null}
                </div>
              ))}
            </div>

            {/* janelas livres em comum */}
            <div className={cn("agenda-coluna agenda-coluna-curta border-borda relative border-r", day.date === today && "bg-detalhe-suave/25")} style={{ "--agenda-horas": hours.length } as CSSProperties}>
              <ul aria-label="Janelas livres em comum" className="contents">
                {day.free.map((window) => {
                  const style = box(window.start, window.end);
                  if (!style) return null;
                  const text = `${window.start} – ${window.end}`;
                  return (
                    <li key={window.start} className="contents">
                      {canEdit ? (
                        <Link href={bookHref(day.date, window, selected, returnTo)} className="agenda-livre absolute inset-x-1 flex flex-col px-2 py-1.5 text-xs" style={style} title={`Marcar neste horário (${text})`}>
                          <span className="font-bold tabular-nums">{text}</span>
                          <span className="mt-0.5 inline-flex items-center gap-1 font-semibold">
                            <CalendarPlus aria-hidden="true" className="size-3.5 shrink-0" />
                            Marcar neste horário
                          </span>
                        </Link>
                      ) : (
                        <div className="agenda-livre absolute inset-x-1 px-2 py-1.5 text-xs" style={style}>
                          <span className="font-bold tabular-nums">{text}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {day.free.length === 0 ? <p className="text-texto-suave absolute inset-x-2 top-3 text-xs leading-snug">Nenhuma janela em comum no expediente deste dia.</p> : null}
            </div>

            {people.map((person) => {
              const entry = day.people[person.id];
              const wholeDay = entry.busy.find((block) => block.wholeDay);
              return (
                <div key={person.id} className="agenda-coluna agenda-coluna-curta border-borda relative border-r last:border-r-0" style={{ "--agenda-horas": hours.length } as CSSProperties}>
                  {/* fora do expediente */}
                  <div aria-hidden="true" className="bg-fundo/50 absolute inset-x-0" style={shade(from, timeToMinutes(workday.start))} />
                  <div aria-hidden="true" className="bg-fundo/50 absolute inset-x-0" style={shade(timeToMinutes(workday.end), to)} />
                  {wholeDay ? <div aria-hidden="true" data-ocupado="" className="agenda-evento absolute inset-x-0.5 opacity-70" style={{ top: 1, bottom: 1, borderRadius: 4 }} /> : null}
                  <ul aria-label={`${person.name}: ${busySummary(entry.busy)}`} className="contents">
                    {entry.busy
                      .filter((block) => !block.wholeDay)
                      .map((block) => {
                        const style = box(block.startTime, block.endTime);
                        if (!style) return null;
                        return (
                          <li key={block.key} className="contents">
                            <Link
                              href={block.href}
                              data-ocupado={block.masked ? "" : undefined}
                              data-status={block.tentative && !block.masked ? "a_confirmar" : undefined}
                              className={cn("agenda-evento absolute inset-x-0.5 px-1.5 py-1 text-xs", TONE_CLASS[block.color])}
                              style={style}
                              title={`${block.title} — ${range(block)}${block.tentative ? " — a confirmar" : ""}`}
                            >
                              <span className="block truncate font-semibold">
                                {block.masked ? <Lock aria-hidden="true" className="mr-1 inline size-3 align-[-1px]" /> : null}
                                {block.title}
                              </span>
                              <span className="text-texto-suave block truncate text-[0.6875rem] tabular-nums">{range(block)}</span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- a semana
function WeekRows({ days, people, workday, today, selected, canEdit, returnTo, dayHrefs }: ViewProps & { days: AvailabilityDay[]; dayHrefs: Record<ISODate, string> }) {
  const template = { gridTemplateColumns: `minmax(6.5rem, 9rem) repeat(${days.length}, minmax(7.5rem, 1fr))` } as CSSProperties;
  return (
    <div className="card agenda-impressao overflow-hidden">
      <div tabIndex={0} role="group" aria-label="Disponibilidade da semana, por pessoa e dia" className="agenda-rolagem relative overflow-x-auto outline-offset-[-2px]">
        <div role="table" aria-label="Disponibilidade da semana" className="min-w-max sm:min-w-0">
          <div role="row" className="border-borda grid border-b" style={template}>
            <div role="columnheader" className="border-borda text-texto-suave sticky left-0 z-10 flex items-end border-r bg-superficie px-3 py-2 text-xs font-semibold">
              {workday.start}–{workday.end}
            </div>
            {days.map((day) => (
              <div key={day.date} role="columnheader" className="border-borda border-r px-1 py-1.5 text-center last:border-r-0">
                <Link href={dayHrefs[day.date] ?? "#"} aria-label={`Abrir ${formatDateLong(day.date)}`} aria-current={day.date === today ? "date" : undefined} className="group inline-flex min-h-11 flex-col items-center justify-center rounded-md px-2">
                  <span className={cn("text-[0.6875rem] font-bold tracking-wide uppercase", day.date === today ? "text-primaria" : "text-texto-suave")}>{formatWeekday(day.date, true)}</span>
                  <span className={cn("flex size-8 items-center justify-center rounded-full text-base font-bold tabular-nums", day.date === today ? "bg-primaria text-sobre-primaria" : "text-texto group-hover:bg-detalhe-suave")}>
                    {Number(day.date.slice(8))}
                  </span>
                </Link>
              </div>
            ))}
          </div>

          {/* janelas em comum */}
          <div role="row" className="border-borda grid border-b" style={template}>
            <div role="rowheader" className="border-borda sticky left-0 z-10 flex flex-col justify-center border-r bg-superficie px-3 py-2">
              <span className="text-primaria text-sm font-bold">Livre em comum</span>
              <span className="text-texto-suave text-xs">{people.length === 1 ? "desta pessoa" : `das ${people.length} pessoas`}</span>
            </div>
            {days.map((day) => (
              <div key={day.date} role="cell" className={cn("border-borda min-w-0 space-y-1 border-r p-1.5 last:border-r-0", day.date === today && "bg-detalhe-suave/25")}>
                {day.free.length === 0 ? <p className="text-texto-suave px-1 py-1.5 text-xs">Sem janela</p> : null}
                {day.free.map((window) =>
                  canEdit ? (
                    <Link
                      key={window.start}
                      href={bookHref(day.date, window, selected, returnTo)}
                      className="agenda-livre flex min-h-11 items-center justify-center px-1.5 text-xs font-bold tabular-nums sm:min-h-8"
                      title={`Marcar neste horário: ${formatDateLong(day.date)}, ${window.start} – ${window.end}`}
                    >
                      {window.start} – {window.end}
                      <span className="sr-only"> — marcar neste horário</span>
                    </Link>
                  ) : (
                    <p key={window.start} className="agenda-livre flex min-h-8 items-center justify-center px-1.5 text-xs font-bold tabular-nums">
                      {window.start} – {window.end}
                    </p>
                  ),
                )}
              </div>
            ))}
          </div>

          {people.map((person) => (
            <div key={person.id} role="row" className="border-borda grid border-b last:border-b-0" style={template}>
              <div role="rowheader" className="border-borda text-texto sticky left-0 z-10 flex items-center gap-2 border-r bg-superficie px-3 py-2 text-sm font-bold">
                <Avatar name={person.name} size="sm" />
                <span className="truncate">{firstName(person.name)}</span>
              </div>
              {days.map((day) => {
                const entry = day.people[person.id];
                const wholeDay = entry.busy.find((block) => block.wholeDay);
                const timed = entry.busy.filter((block) => !block.wholeDay);
                return (
                  <div key={day.date} role="cell" className={cn("border-borda min-w-0 border-r px-1.5 py-2 last:border-r-0", day.date === today && "bg-detalhe-suave/25")}>
                    <span className="sr-only">{busySummary(entry.busy)}</span>
                    <div aria-hidden="true" className="agenda-barra">
                      {wholeDay ? (
                        <span data-ocupado="" className="agenda-evento absolute inset-0 flex items-center px-1.5 text-[0.6875rem] font-semibold" title={`Indisponível: ${wholeDay.title}`}>
                          <span className="truncate">{wholeDay.title}</span>
                        </span>
                      ) : (
                        timed.map((block) => {
                          const segment = barSegment(block.startTime, block.endTime, workday);
                          if (!segment) return null;
                          return (
                            <span
                              key={block.key}
                              data-ocupado={block.masked ? "" : undefined}
                              className={cn("agenda-evento absolute inset-y-0", TONE_CLASS[block.color])}
                              style={{ left: `${segment.left}%`, width: `max(${segment.width}%, 3px)`, borderRadius: 3 }}
                              title={`${block.title} — ${range(block)}`}
                            />
                          );
                        })
                      )}
                    </div>
                    <p aria-hidden="true" className="text-texto-suave mt-1 truncate text-[0.6875rem] tabular-nums">
                      {wholeDay ? "dia inteiro" : timed.length === 0 ? "livre" : timed.map((block) => block.startTime).join(" · ")}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
