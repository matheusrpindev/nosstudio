import { ChartGantt } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { dayOffset, spanInWindow, type Milestone, type MilestoneKind } from "@/lib/agenda/timeline";
import { TIMELINE_WEEKS, timeLabel } from "@/lib/agenda/view";
import { cn } from "@/lib/cn";
import { addDays, addMonths, diffDays, endOfMonth, formatDate, formatDateShort, startOfMonth, type ISODate } from "@/lib/dates";
import { PROJECT_STAGE_LABELS, type AgendaColor } from "@/lib/domain";
import type { TimelineRow } from "@/server/agenda/timeline";
import { itemDataProps, itemSummary, TONE_CLASS } from "../ui";
import type { TimelineMonths } from "../url";

type Props = {
  rows: TimelineRow[];
  from: ISODate;
  to: ISODate;
  today: ISODate;
  months: TimelineMonths;
  scaleHrefs: Record<TimelineMonths, string>;
  /** Há filtro de cliente/projeto ligado (vindo das outras visões). */
  filtered: boolean;
  clearHref: string;
};

const MILESTONE_TONE: Record<MilestoneKind, AgendaColor> = { inicio: "cinza", evento: "laranja", gravacao: "lima", entrega: "vermelho", entregue: "verde" };
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const milestoneText = (mark: Milestone) => `${mark.label}: ${formatDate(mark.date)}${mark.late ? " (atrasado)" : ""}`;

/**
 * Linha do tempo de projetos: uma linha por projeto ativo, com os marcos do cadastro (◆) e os compromissos
 * ligados ao projeto (barras na cor da categoria). A linha vertical marca hoje. No celular vira uma lista por
 * projeto (a faixa não cabe com alvos de toque decentes).
 */
export function TimelineView({ rows, from, to, today, months, scaleHrefs, filtered, clearHref }: Props) {
  const weeks = TIMELINE_WEEKS[months];
  const todayLeft = today >= from && today <= to ? dayOffset(from, to, today) + 50 / (diffDays(from, to) + 1) : null;
  const monthSpans: { key: string; label: string; left: number; width: number }[] = [];
  for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1)) {
    const span = spanInWindow(from, to, month, endOfMonth(month));
    if (span) monthSpans.push({ key: month, label: `${MONTH_SHORT[Number(month.slice(5, 7)) - 1]}${month.slice(5, 7) === "01" || month === startOfMonth(from) ? ` ${month.slice(0, 4)}` : ""}`, ...span });
  }
  const weekLines = { backgroundImage: "linear-gradient(to right, var(--color-borda) 1px, transparent 1px)", backgroundSize: `${100 / weeks}% 100%` } as CSSProperties;
  const template = { gridTemplateColumns: `minmax(11rem, 15rem) minmax(${months === 3 ? 38 : 52}rem, 1fr)` } as CSSProperties;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 print:hidden">
        <nav aria-label="Escala da linha do tempo" className="border-borda-forte flex shrink-0 rounded-campo border bg-superficie p-0.5">
          {([3, 6] as const).map((scale) => (
            <Link
              key={scale}
              href={scaleHrefs[scale]}
              aria-current={months === scale ? "page" : undefined}
              className={cn("flex min-h-10 items-center justify-center rounded-[0.5rem] px-4 text-sm font-semibold transition-colors", months === scale ? "bg-detalhe-suave text-detalhe" : "text-texto-suave hover:text-texto")}
            >
              {scale} meses
            </Link>
          ))}
        </nav>
        <ul aria-label="Legenda" className="text-texto-suave flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {(Object.keys(MILESTONE_TONE) as MilestoneKind[]).map((kind) => (
            <li key={kind} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("agenda-marco", TONE_CLASS[MILESTONE_TONE[kind]])} />
              {kind === "inicio" ? "Início" : kind === "evento" ? "Evento" : kind === "gravacao" ? "Prazo de gravação" : kind === "entrega" ? "Prazo de entrega" : "Entregue"}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="agenda-evento agenda-tom-roxo inline-block h-3 w-6" />
            Compromisso
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="bg-primaria inline-block h-3.5 w-0.5" />
            Hoje
          </li>
        </ul>
        {filtered ? (
          <Link href={clearHref} className="link inline-flex min-h-11 items-center text-sm">
            Ver todos os projetos
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ChartGantt />}
          title={filtered ? "Nenhum projeto ativo com este filtro" : "Nenhum projeto ativo"}
          description="A linha do tempo mostra os projetos em andamento (do briefing à revisão) a que você tem acesso, com os prazos do cadastro e os compromissos ligados a cada um."
        />
      ) : (
        <>
          {/* faixa (a partir de 640px) */}
          <div className="card agenda-impressao overflow-hidden max-sm:hidden print:!block">
            <div tabIndex={0} role="group" aria-label="Linha do tempo dos projetos" className="agenda-rolagem overflow-x-auto outline-offset-[-2px]">
              <div className="min-w-max lg:min-w-0">
                <div className="border-borda grid border-b" style={template}>
                  <div className="border-borda text-texto-suave sticky left-0 z-20 flex items-end border-r bg-superficie px-3 py-2 text-xs font-bold tracking-wide uppercase">Projeto</div>
                  <div className="relative h-10" aria-hidden="true">
                    {monthSpans.map((month) => (
                      <span key={month.key} className="border-borda text-texto-suave absolute inset-y-0 flex items-center border-l px-2 text-xs font-bold tracking-wide uppercase" style={{ left: `${month.left}%`, width: `${month.width}%` }}>
                        <span className="truncate">{month.label}</span>
                      </span>
                    ))}
                    {todayLeft !== null ? (
                      <span className="text-primaria absolute bottom-0 -translate-x-1/2 text-[0.625rem] font-bold uppercase" style={{ left: `${todayLeft}%` }}>
                        hoje
                      </span>
                    ) : null}
                  </div>
                </div>
                <ul>
                  {rows.map((row) => {
                    const dates = [...row.milestones.map((mark) => mark.date), ...row.events.flatMap((item) => [item.date, item.endDate])].sort();
                    const span = dates.length > 1 ? spanInWindow(from, to, dates[0], dates[dates.length - 1]) : null;
                    return (
                      <li key={row.id} className="border-borda grid border-b last:border-b-0" style={template}>
                        <div className="border-borda sticky left-0 z-20 min-w-0 border-r bg-superficie px-3 py-2">
                          <Link href={row.href} className="text-texto hover:text-detalhe block truncate text-sm font-bold" title={row.title}>
                            {row.title}
                          </Link>
                          <p className="text-texto-suave mt-0.5 flex items-center gap-1.5 text-xs">
                            <span className="truncate">{row.clientName ?? "Sem cliente"}</span>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0">{PROJECT_STAGE_LABELS[row.stage]}</span>
                          </p>
                        </div>
                        <div className="relative h-[3.75rem]" style={weekLines}>
                          {span ? <span aria-hidden="true" className="bg-borda-forte/70 absolute top-[1.0625rem] h-0.5 rounded-full" style={{ left: `${span.left}%`, width: `${span.width}%` }} /> : null}
                          {todayLeft !== null ? <span aria-hidden="true" className="bg-primaria absolute inset-y-0 z-10 w-0.5 -translate-x-1/2" style={{ left: `${todayLeft}%` }} /> : null}
                          {row.milestones.map((mark) => {
                            if (mark.date < from || mark.date > to) return null;
                            const left = dayOffset(from, to, mark.date) + 50 / (diffDays(from, to) + 1);
                            return (
                              <Link
                                key={mark.kind}
                                href={row.href}
                                aria-label={`${row.title} — ${milestoneText(mark)}`}
                                title={milestoneText(mark)}
                                className="absolute top-1 z-[11] flex size-7 -translate-x-1/2 items-center justify-center rounded-md"
                                style={{ left: `${left}%` }}
                              >
                                <span aria-hidden="true" data-atrasado={mark.late ? "" : undefined} className={cn("agenda-marco", TONE_CLASS[MILESTONE_TONE[mark.kind]])} />
                              </Link>
                            );
                          })}
                          {row.events.map((item) => {
                            const place = spanInWindow(from, to, item.date, item.endDate);
                            if (!place) return null;
                            const summary = `${formatDateShort(item.date)} — ${itemSummary(item, timeLabel(item))}`;
                            return (
                              <Link
                                key={item.key}
                                href={item.href}
                                aria-label={`${row.title} — ${summary}`}
                                title={summary}
                                {...itemDataProps(item)}
                                className={cn("agenda-evento absolute bottom-2 z-[11] h-[1.125rem]", TONE_CLASS[item.color])}
                                style={{ left: `${place.left}%`, width: `max(${place.width}%, 0.625rem)` }}
                              />
                            );
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* lista (celular) */}
          <ul className="space-y-3 sm:hidden print:hidden">
            {rows.map((row) => {
              const entries = [
                ...row.milestones.map((mark) => ({ key: `m-${mark.kind}`, date: mark.date, href: row.href, text: mark.label, time: "", tone: MILESTONE_TONE[mark.kind], late: mark.late, milestone: true })),
                ...row.events.map((item) => ({ key: item.key, date: item.date, href: item.href, text: item.title, time: item.startTime ?? "", tone: item.color, late: false, milestone: false })),
              ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
              return (
                <li key={row.id} className="card overflow-hidden">
                  <Link href={row.href} className="hover:bg-superficie-alta flex min-h-14 flex-col justify-center px-4 py-2.5">
                    <span className="text-texto text-sm font-bold break-words">{row.title}</span>
                    <span className="text-texto-suave mt-0.5 text-xs">
                      {row.clientName ?? "Sem cliente"} · {PROJECT_STAGE_LABELS[row.stage]}
                    </span>
                  </Link>
                  {entries.length > 0 ? (
                    <ul className="divide-borda border-borda divide-y border-t">
                      {entries.map((entry) => (
                        <li key={entry.key}>
                          <Link href={entry.href} className={cn("hover:bg-superficie-alta flex min-h-11 items-center gap-2.5 px-4 py-2 text-sm", entry.date < today && !entry.late && "opacity-70")}>
                            <span aria-hidden="true" className={cn(entry.milestone ? "agenda-marco" : "agenda-ponto", TONE_CLASS[entry.tone])} />
                            <span className="text-texto-suave w-[4.5rem] shrink-0 text-[0.8125rem] font-semibold tabular-nums">{entry.date === today ? "hoje" : formatDateShort(entry.date)}</span>
                            <span className="text-texto min-w-0 flex-1 break-words">
                              {entry.time ? <span className="text-texto-suave tabular-nums">{entry.time} </span> : null}
                              {entry.text}
                            </span>
                            {entry.late ? <Badge tone="perigo">Atrasado</Badge> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="border-borda text-texto-suave border-t px-4 py-3 text-sm">Sem prazos no cadastro nem compromissos no período.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="text-texto-suave text-xs leading-relaxed">
        Os marcos vêm do cadastro de cada projeto (início, data do evento, prazo de gravação, prazo de entrega e entrega feita): para mudá-los, abra o projeto. Os compromissos são os da agenda ligados ao projeto.
      </p>
    </div>
  );
}
