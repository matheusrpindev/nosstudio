/**
 * Um compromisso da agenda mostrado FORA da agenda (visão geral, ficha do cliente, projeto). Recebe sempre um
 * `AgendaItem` — isto é, algo que já passou pela privacidade da agenda (`listAgenda`): particular de outra pessoa
 * chega com `masked` e título "Ocupado", e estas peças não têm de onde tirar mais nada.
 */
import { Lock, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgendaItem } from "@/lib/agenda/view";
import { cn } from "@/lib/cn";
import type { ISODate } from "@/lib/dates";
import { AGENDA_STATUS_LABELS } from "@/lib/domain";
import { STATUS_TONES, TONE_CLASS } from "../agenda/ui";

/** A visão "Dia" da agenda numa data. */
export const agendaDayHref = (date: ISODate) => `/painel/agenda?vista=dia&data=${date}`;

/** A visão "Lista" da agenda filtrada por um cliente ou por um projeto. */
export const agendaListHref = (filter: { clientId?: number; projectId?: number }) =>
  `/painel/agenda?vista=lista${filter.clientId ? `&cliente=${filter.clientId}` : ""}${filter.projectId ? `&projeto=${filter.projectId}` : ""}`;

/** Título: "Ocupado" com cadeado quando mascarado; marca de repetição quando é série. */
export function AgendaItemTitle({ item, className }: { item: Pick<AgendaItem, "title" | "masked" | "recurring" | "status">; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", item.status === "cancelado" && "line-through", className)}>
      {item.masked ? <Lock aria-hidden="true" className="text-texto-suave size-3.5 shrink-0" /> : null}
      <span className="min-w-0 break-words">{item.title}</span>
      {item.recurring ? <Repeat role="img" aria-label="Repete" className="text-texto-suave size-3.5 shrink-0" /> : null}
    </span>
  );
}

/**
 * Categoria (bolinha na cor da categoria + nome) e, quando não é "confirmado", o status.
 * Mascarado: sem cor nem categoria — só "compromisso particular" e de quem é.
 */
export function AgendaItemCategory({ item }: { item: Pick<AgendaItem, "masked" | "color" | "label" | "status" | "ownerName"> }) {
  if (item.masked) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="agenda-ponto agenda-tom-cinza" />
        {item.ownerName ? `${item.ownerName} · compromisso particular` : "Compromisso particular"}
      </span>
    );
  }
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={cn("agenda-ponto", TONE_CLASS[item.color])} />
        {item.label}
      </span>
      {item.status && item.status !== "confirmado" ? <Badge tone={STATUS_TONES[item.status]}>{AGENDA_STATUS_LABELS[item.status]}</Badge> : null}
    </>
  );
}
