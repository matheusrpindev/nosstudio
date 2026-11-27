import { ExternalLink, FileText, Lock, MapPin, Repeat, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { firstParam, type PageSearchParams } from "@/components/ui/search-params";
import { canEverywhere } from "@/lib/auth";
import { ruleOf } from "@/lib/agenda/expand";
import { describeRecurrence } from "@/lib/agenda/recurrence";
import { cn } from "@/lib/cn";
import { formatDate, formatDateLong, formatWeekday, isISODate, todayISO, type ISODate } from "@/lib/dates";
import { AGENDA_PRIORITY_LABELS, AGENDA_REMINDER_CHANNEL_LABELS, AGENDA_STATUS_LABELS } from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { requireScopedPermission } from "@/server/access/guards";
import { getEventView } from "@/server/agenda/queries";
import { getMediaValues } from "@/server/media";
import { CategoryIcon } from "../icons";
import { describeReminder, PRIORITY_TONES, STATUS_TONES, TONE_CLASS } from "../ui";
import { ChecklistToggles, DetailActions } from "./detail-actions";

export const metadata: Metadata = { title: "Compromisso" };
export const instant = false;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function when(date: ISODate, endDate: ISODate, startTime: string | null, endTime: string | null): string {
  const day = `${capitalize(formatWeekday(date))}, ${formatDateLong(date)}`;
  if (endDate > date) {
    const end = `${formatWeekday(endDate)}, ${formatDateLong(endDate)}`;
    return startTime ? `${day}, ${startTime} — até ${end}${endTime ? `, ${endTime}` : ""}` : `${day} — até ${end} (dias inteiros)`;
  }
  if (!startTime) return `${day} · dia inteiro`;
  return `${day} · ${startTime}${endTime ? ` – ${endTime}` : ""}`;
}

function External({ href, children }: { href: string; children: ReactNode }) {
  const url = safeUrl(href);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5 break-all">
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

const Text = ({ children }: { children: string }) => <p className="text-texto text-sm leading-relaxed break-words whitespace-pre-line">{children}</p>;

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PageSearchParams }) {
  const { user } = await requireScopedPermission("agenda", "ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const dayParam = firstParam((await searchParams).dia);
  const today = todayISO();
  const view = await getEventView(user, id, dayParam && isISODate(dayParam) ? dayParam : null, today);
  if (!view) notFound();
  const { event, occurrence, occurrenceEnd } = view;
  const back = { href: `/painel/agenda?data=${occurrence}`, label: "Agenda" };

  // ------------------------------------------------- particular de outra pessoa: só o horário
  if (event.masked) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Ocupado" back={back} badge={<Badge tone="neutral">Particular</Badge>} />
        <Card>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="bg-superficie-alta text-texto-suave flex size-11 shrink-0 items-center justify-center rounded-full">
              <Lock className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-texto font-semibold">{when(occurrence, occurrenceEnd, event.startTime, event.endTime)}</p>
              <p className="text-texto-suave mt-1 text-sm leading-relaxed">
                {event.ownerName ? `${event.ownerName} marcou este horário como compromisso particular.` : "Este horário está marcado como compromisso particular."} Os detalhes só aparecem para quem
                participa dele.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const rule = ruleOf(event);
  // quem só vê a agenda "nos projetos em que está" altera apenas os próprios compromissos — e, nos dos outros,
  // não recebe observações internas, anexos nem os links para clientes e projetos que não abre
  const { canEdit, fullAccess } = view;
  const canDelete = canEverywhere(user, "agenda", "excluir");
  const seesInternals = fullAccess || canEdit;
  const attachments = seesInternals ? await getMediaValues(event.attachments ?? []) : [];
  const clientLink = canEverywhere(user, "clientes", "ver");
  const responsible = event.people.filter((person) => person.role === "responsavel").map((person) => person.name);
  const participants = event.people.filter((person) => person.role === "participante").map((person) => person.name);
  const externals = event.people.filter((person) => person.role === "externo").map((person) => person.name);
  const plan = event.production;
  const showPlan = Boolean(plan) && event.categoryIsProduction;
  const dayQuery = rule ? `?dia=${occurrence}` : "";

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={event.title}
        back={back}
        badge={
          <>
            <StatusBadge value={event.status} labels={AGENDA_STATUS_LABELS} tones={STATUS_TONES} />
            {event.visibility === "particular" ? (
              <Badge tone="neutral">
                <Lock aria-hidden="true" className="size-3" /> Particular
              </Badge>
            ) : null}
            {event.priority !== "normal" ? <Badge tone={PRIORITY_TONES[event.priority]}>Prioridade {AGENDA_PRIORITY_LABELS[event.priority].toLowerCase()}</Badge> : null}
          </>
        }
        description={
          <span className="text-texto inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
            {when(occurrence, occurrenceEnd, event.startTime, event.endTime)}
            {rule ? (
              <span className="text-texto-suave inline-flex items-center gap-1 font-normal">
                <Repeat aria-hidden="true" className="size-3.5" />
                {describeRecurrence(event.date, rule)}
              </span>
            ) : event.seriesId ? (
              <span className="text-texto-suave font-normal">· ocorrência alterada de uma série</span>
            ) : null}
          </span>
        }
      />

      <div className="mb-5">
        <DetailActions
          id={event.id}
          occurrence={occurrence}
          recurring={rule !== null}
          first={occurrence === event.date}
          status={event.status}
          startTime={event.startTime}
          endTime={event.endTime}
          canEdit={canEdit}
          canDelete={canDelete}
          editHref={`/painel/agenda/${event.id}/editar${dayQuery}`}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Card>
            <DescriptionList
              hideEmpty
              items={[
                {
                  label: "Categoria",
                  value: (
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className={cn("agenda-ponto", TONE_CLASS[event.categoryColor ?? "cinza"])} />
                      <CategoryIcon name={event.categoryIcon} className="text-texto-suave size-4" />
                      {event.categoryName ?? "Sem categoria"}
                    </span>
                  ),
                },
                { label: "Agenda", value: event.calendarName ? (event.calendarKind === "pessoal" ? `${event.calendarName} (pessoal)` : event.calendarName) : null },
                {
                  label: "Local",
                  value:
                    event.location || event.mapUrl ? (
                      <span className="flex flex-col gap-1">
                        {event.location ? (
                          <span className="inline-flex items-start gap-1.5">
                            <MapPin aria-hidden="true" className="text-texto-suave mt-0.5 size-4 shrink-0" />
                            {event.location}
                          </span>
                        ) : null}
                        {event.mapUrl ? <External href={event.mapUrl}>Abrir no mapa</External> : null}
                      </span>
                    ) : null,
                },
                {
                  label: "Reunião virtual",
                  value: event.meetingUrl ? (
                    <External href={event.meetingUrl}>
                      <Video aria-hidden="true" className="size-4 shrink-0" />
                      Entrar na reunião
                    </External>
                  ) : null,
                },
                {
                  label: "Cliente",
                  value: event.clientId ? (
                    clientLink ? (
                      <Link href={`/painel/clientes/${event.clientId}`} className="link">
                        {event.clientName}
                      </Link>
                    ) : (
                      event.clientName
                    )
                  ) : null,
                },
                {
                  label: "Projeto",
                  value: event.projectId ? (
                    <Link href={`/painel/projetos/${event.projectId}`} className="link">
                      {event.projectTitle}
                    </Link>
                  ) : null,
                },
                { label: "Responsáveis", value: responsible.length ? responsible.join(", ") : null },
                { label: "Participantes", value: participants.length ? participants.join(", ") : null },
                { label: "Participantes externos", value: externals.length ? externals.join(", ") : null },
                {
                  label: "Lembretes",
                  value: event.reminders?.length ? event.reminders.map((reminder) => `${describeReminder(reminder.minutes)} (${AGENDA_REMINDER_CHANNEL_LABELS[reminder.channel].toLowerCase()})`).join(" · ") : null,
                },
              ]}
            />
          </Card>

          {event.description ? (
            <Card as="section" aria-labelledby="descricao-titulo">
              <CardHeader id="descricao-titulo" title="Descrição" />
              <Text>{event.description}</Text>
            </Card>
          ) : null}

          {showPlan && plan ? (
            <Card as="section" aria-labelledby="gravacao-titulo">
              <CardHeader id="gravacao-titulo" title="Planejamento de gravação" />
              <DescriptionList
                hideEmpty
                items={[
                  { label: "Endereço", value: plan.address || null },
                  { label: "Chegada da equipe", value: plan.crewArrival },
                  { label: "Conteúdos previstos", value: plan.contentCount === null ? null : String(plan.contentCount) },
                  {
                    label: "Tempo estimado",
                    value: plan.estimatedMinutes === null ? null : `${String(Math.round((plan.estimatedMinutes / 60) * 100) / 100).replace(".", ",")} h`,
                  },
                  { label: "Prazo de edição", value: plan.editDeadline ? formatDate(plan.editDeadline) : null },
                  { label: "Data de entrega", value: plan.deliveryDate ? formatDate(plan.deliveryDate) : null },
                  { label: "Roteiro", value: plan.script ? <Text>{plan.script}</Text> : null, wide: true },
                  { label: "Referências", value: plan.references ? <Text>{plan.references}</Text> : null, wide: true },
                  { label: "Equipamentos", value: plan.equipment ? <Text>{plan.equipment}</Text> : null, wide: true },
                ]}
              />
              {plan.prepChecklist.length > 0 ? (
                <div className="mt-5">
                  <h3 className="text-texto mb-2 text-sm font-bold">Checklist de preparação</h3>
                  <ChecklistToggles eventId={event.id} list="prep" items={plan.prepChecklist} canEdit={canEdit} label="Checklist de preparação" />
                </div>
              ) : null}
            </Card>
          ) : null}

          {event.notes && seesInternals ? (
            <Card as="section" aria-labelledby="notas-titulo">
              <CardHeader id="notas-titulo" title="Observações internas" />
              <Text>{event.notes}</Text>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {event.checklist?.length ? (
            <Card as="section" aria-labelledby="checklist-titulo">
              <CardHeader id="checklist-titulo" title="Checklist" description={rule ? "Vale para a série inteira." : undefined} />
              <ChecklistToggles eventId={event.id} list="checklist" items={event.checklist} canEdit={canEdit} label="Checklist" />
            </Card>
          ) : null}

          {attachments.length > 0 ? (
            <Card as="section" aria-labelledby="anexos-titulo">
              <CardHeader id="anexos-titulo" title="Anexos" />
              <ul className="space-y-1">
                {attachments.map((file) => {
                  const inline = file.mime === "application/pdf" || file.mime.startsWith("image/");
                  return (
                    <li key={file.id}>
                      <a href={inline ? `${file.url}?inline=1` : file.url} target="_blank" rel="noopener noreferrer" className="hover:bg-superficie-alta -mx-2 flex min-h-11 items-center gap-2.5 rounded-md px-2 text-sm">
                        <FileText aria-hidden="true" className="text-detalhe size-5 shrink-0" />
                        <span className="link min-w-0 truncate">{file.originalName}</span>
                        <span className="sr-only">({inline ? "abre em nova aba" : "baixa o arquivo"})</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          <p className="text-texto-suave px-1 text-xs leading-relaxed">
            {event.creatorName ? `Criado por ${event.creatorName}.` : null} {event.visibility === "particular" ? "Compromisso particular: as outras pessoas veem só “Ocupado” neste horário." : null}
          </p>
        </div>
      </div>
    </div>
  );
}
