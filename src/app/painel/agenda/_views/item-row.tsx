import { Lock, MapPin, Repeat, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { timeLabel, type AgendaItem } from "@/lib/agenda/view";
import { cn } from "@/lib/cn";
import { AGENDA_STATUS_LABELS } from "@/lib/domain";
import { CategoryIcon } from "../icons";
import { itemDataProps, LAYER_MARK, STATUS_TONES, TONE_CLASS } from "../ui";

/** Uma linha de compromisso nas listas (visão Lista, dia selecionado do mês no celular). */
export function ItemRow({ item, day }: { item: AgendaItem; day?: string }) {
  const continues = day !== undefined && item.date < day;
  return (
    <Link
      href={item.href}
      {...itemDataProps(item)}
      className={cn(
        "hover:bg-superficie-alta flex min-h-14 items-start gap-3 px-3 py-2.5 focus-visible:outline-offset-[-2px] sm:px-4",
        item.status === "cancelado" && "opacity-70",
      )}
    >
      <span className="text-texto-suave w-[5.25rem] shrink-0 pt-0.5 text-[0.8125rem] font-semibold tabular-nums">
        {continues ? "continua" : item.startTime ? timeLabel(item) : "Dia inteiro"}
      </span>
      <span aria-hidden="true" className={cn("agenda-ponto mt-1.5", item.masked ? "agenda-tom-cinza" : TONE_CLASS[item.color])} />
      <span className="min-w-0 flex-1">
        <span className={cn("text-texto flex items-center gap-1.5 text-sm font-semibold", item.status === "cancelado" && "line-through")}>
          {item.source !== "event" ? (
            <span aria-hidden="true" className="text-texto-suave">
              {LAYER_MARK[item.source]}
            </span>
          ) : null}
          {item.masked ? <Lock aria-hidden="true" className="text-texto-suave size-3.5 shrink-0" /> : null}
          <span className="min-w-0 break-words">{item.title}</span>
          {item.recurring ? <Repeat aria-label="Repete" className="text-texto-suave size-3.5 shrink-0" /> : null}
        </span>
        <span className="text-texto-suave mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
          {item.masked ? (
            <span>{item.ownerName ? `${item.ownerName} · compromisso particular` : "Compromisso particular"}</span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                {item.source === "event" ? <CategoryIcon name={item.icon} className="size-3.5" /> : null}
                {item.label}
              </span>
              {item.status && item.status !== "confirmado" ? <Badge tone={STATUS_TONES[item.status]}>{AGENDA_STATUS_LABELS[item.status]}</Badge> : null}
              {item.priority === "alta" ? <Badge tone="perigo">Prioridade alta</Badge> : null}
              {item.clientName ? <span>{item.clientName}</span> : null}
              {item.location ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </span>
              ) : null}
              {item.people.length > 0 ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Users aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{item.people.map((name) => name.split(" ")[0]).join(", ")}</span>
                </span>
              ) : null}
            </>
          )}
        </span>
      </span>
    </Link>
  );
}
