/**
 * Apresentação compartilhada entre as telas da agenda. Rótulos e enums vêm de `src/lib/domain.ts`;
 * aqui ficam só as decisões visuais do módulo (classe de cada tom, tons dos status).
 */
import type { BadgeTone } from "@/components/ui/badge";
import type { AgendaItem } from "@/lib/agenda/view";
import { AGENDA_REMINDER_PRESETS, type AgendaColor, type AgendaPriority, type AgendaStatus } from "@/lib/domain";

/** Classe que define `--tom` (globals.css, bloco "agenda"). Escrita por extenso para o Tailwind não podar. */
export const TONE_CLASS: Record<AgendaColor, string> = {
  roxo: "agenda-tom-roxo",
  lavanda: "agenda-tom-lavanda",
  lima: "agenda-tom-lima",
  verde: "agenda-tom-verde",
  ciano: "agenda-tom-ciano",
  azul: "agenda-tom-azul",
  rosa: "agenda-tom-rosa",
  laranja: "agenda-tom-laranja",
  amarelo: "agenda-tom-amarelo",
  vermelho: "agenda-tom-vermelho",
  cinza: "agenda-tom-cinza",
};

export const STATUS_TONES: Record<AgendaStatus, BadgeTone> = {
  confirmado: "sucesso",
  a_confirmar: "alerta",
  cancelado: "perigo",
  concluido: "neutral",
};

export const PRIORITY_TONES: Record<AgendaPriority, BadgeTone> = { baixa: "neutral", normal: "neutral", alta: "perigo" };

/** Marca dos itens de camada (não depender só da cor): ◆ prazo · $ financeiro · ✎ publicação. */
export const LAYER_MARK: Record<Exclude<AgendaItem["source"], "event">, string> = { deadline: "◆", finance: "$", editorial: "✎" };

/** Atributos `data-*` que o CSS usa para desenhar o bloco (status, ocupado, camada). */
export function itemDataProps(item: Pick<AgendaItem, "masked" | "status" | "source">): Record<string, string | undefined> {
  return {
    "data-status": item.masked ? undefined : (item.status ?? undefined),
    "data-ocupado": item.masked ? "" : undefined,
    "data-camada": item.source !== "event" ? "" : undefined,
  };
}

/** Texto completo do item para leitor de tela e `title`: "Reunião — 19:30 – 20:30 — Reuniões com clientes". */
export function itemSummary(item: AgendaItem, time: string): string {
  if (item.masked) return `Ocupado${item.ownerName ? ` (${item.ownerName})` : ""} — ${time}`;
  return [item.title, time, item.label, item.status === "cancelado" ? "cancelado" : item.status === "a_confirmar" ? "a confirmar" : null, item.clientName, item.location]
    .filter(Boolean)
    .join(" — ");
}

/** "1 hora antes", "3 dias antes"… */
export function describeReminder(minutes: number): string {
  const preset = AGENDA_REMINDER_PRESETS.find((item) => item.minutes === minutes);
  if (preset) return preset.label;
  if (minutes === 0) return "Na hora";
  if (minutes % 1440 === 0) return `${minutes / 1440} dias antes`;
  if (minutes % 60 === 0) return `${minutes / 60} horas antes`;
  return `${minutes} minutos antes`;
}
