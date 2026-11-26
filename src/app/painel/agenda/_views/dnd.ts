/**
 * Apoio ao arrastar e soltar da agenda (dnd-kit): textos em pt-BR para leitores de tela e o bloqueio do clique
 * que o navegador dispara ao soltar (os blocos são links: sem isto, soltar abriria o compromisso).
 */
import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";

type WithTitle = { item?: { title?: string } } | undefined;
const titleOf = (data: unknown) => (data as WithTitle)?.item?.title ?? "compromisso";

export const DND_ANNOUNCEMENTS: Announcements = {
  onDragStart: ({ active }) => `Movendo ${titleOf(active.data.current)}.`,
  onDragOver: () => undefined,
  onDragEnd: ({ active }) => `${titleOf(active.data.current)} solto.`,
  onDragCancel: ({ active }) => `Movimento de ${titleOf(active.data.current)} cancelado.`,
};

export const DND_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable: "Para mudar a data ou o horário sem arrastar, abra o compromisso e use Reagendar.",
};

const block = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * `arm()` no início do gesto, `release()` no fim: o clique que vem logo depois de soltar é cancelado (na fase de
 * captura, na janela — antes de qualquer outro ouvinte), e o bloqueio some em seguida.
 */
export const suppressNextClick = {
  arm() {
    window.addEventListener("click", block, true);
  },
  release() {
    window.setTimeout(() => window.removeEventListener("click", block, true), 80);
  },
};
