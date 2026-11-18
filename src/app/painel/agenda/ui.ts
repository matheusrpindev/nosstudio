/**
 * Apresentação da agenda compartilhada entre as telas do módulo. Os RÓTULOS vêm de `src/lib/domain.ts`;
 * aqui ficam só as cores de cada tipo (decisão visual do módulo).
 */
import type { CalendarTone } from "@/components/ui/month-calendar";
import type { AgendaKind } from "@/lib/domain";
import type { AgendaEntry } from "@/server/agenda/logic";

export const AGENDA_KIND_TONES: Record<AgendaKind, CalendarTone> = {
  gravacao: "roxo",
  evento: "lima",
  reuniao: "sucesso",
  entrega: "alerta",
  outro: "neutral",
};

/** Prazos de projeto são somente leitura: cor própria (vermelha) + losango no texto, para não depender só da cor. */
export const DEADLINE_TONE: CalendarTone = "perigo";
export const DEADLINE_MARK = "◆";

/** "Das 14:00 às 16:00" / "14:00" / "Dia inteiro". */
export function timeLabel(
  entry: Pick<AgendaEntry, "startTime" | "endTime">,
): string {
  if (!entry.startTime) return "Dia inteiro";
  return entry.endTime
    ? `${entry.startTime} – ${entry.endTime}`
    : entry.startTime;
}
