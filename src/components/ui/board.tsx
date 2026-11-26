"use client";

/**
 * <Board>: quadro kanban genérico (funil de clientes, etapas de projeto, status de conteúdo…).
 *
 * - Mover cartão: arrastando (mouse, toque com pressão longa, teclado pela alça) OU pelo seletor
 *   "Mover para…" de cada cartão (o caminho principal no celular e com leitor de tela).
 * - Atualização otimista: o cartão muda de coluna na hora; se a Server Action devolver `ok: false`
 *   (ou falhar), ele volta e a mensagem aparece acima do quadro.
 * - `onMove` é uma Server Action: comece com `await requireUser()`, valide `toColumnId` e chame `refresh()`.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

export type BoardTone = "neutral" | "roxo" | "lima" | "sucesso" | "alerta" | "perigo";

export type BoardColumn = {
  id: string;
  title: string;
  /** Cor do marcador da coluna (mesmos nomes das classes `.badge-*`). Padrão: `neutral`. */
  tone?: BoardTone;
};

export type BoardCard = {
  id: number;
  columnId: string;
  /** Nome do cartão para leitores de tela e para o seletor "Mover para…" (ex.: nome do cliente). */
  label?: string;
  /** Conteúdo já renderizado — alternativa a `renderCard` quando o <Board> é usado direto num Server Component. */
  content?: ReactNode;
};

export type BoardProps<C extends BoardCard> = {
  columns: BoardColumn[];
  cards: C[];
  /** Desenha o miolo do cartão. É uma função: só pode ser passada a partir de um Client Component. */
  renderCard?: (card: C) => ReactNode;
  /** Server Action chamada ao mover. `ok: false` desfaz a mudança e mostra `message`. */
  onMove: (cardId: number, toColumnId: string) => Promise<ActionState>;
  /** Texto das colunas vazias. */
  emptyLabel?: string;
  /** Nome acessível do quadro (ex.: "Funil de clientes"). */
  label?: string;
  className?: string;
};

const TONE_DOT: Record<BoardTone, string> = {
  neutral: "bg-borda-forte",
  roxo: "bg-roxo",
  lima: "bg-lima",
  sucesso: "bg-sucesso",
  alerta: "bg-alerta",
  perigo: "bg-perigo",
};

const GENERIC_ERROR = "Não foi possível mover o cartão. Tente de novo.";
const columnDropId = (id: string) => `coluna:${id}`;
const fromDropId = (id: unknown) => (typeof id === "string" && id.startsWith("coluna:") ? id.slice(7) : null);

/** Elementos interativos dentro do cartão não iniciam arraste com mouse/toque (links, seletor, botões). */
function startsOnInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a, button, select, input, textarea, label, [data-no-drag]") !== null;
}

class CardMouseSensor extends MouseSensor {
  static activators: (typeof MouseSensor)["activators"] = [
    {
      eventName: "onMouseDown",
      handler: ({ nativeEvent: event }) => event.button === 0 && !startsOnInteractive(event.target),
    },
  ];
}

class CardTouchSensor extends TouchSensor {
  static activators: (typeof TouchSensor)["activators"] = [
    {
      eventName: "onTouchStart",
      handler: ({ nativeEvent: event }) => event.touches.length === 1 && !startsOnInteractive(event.target),
    },
  ];
}

/** Com o ponteiro: a coluna sob o cursor. Com o teclado (sem ponteiro): a coluna que o cartão cobre. */
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length > 0 ? pointer : rectIntersection(args);
};

/** Teclado: ← → pulam para a coluna vizinha (em vez de andar alguns pixels). */
const columnJump: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  if (event.code !== KeyboardCode.Left && event.code !== KeyboardCode.Right) {
    if (event.code === KeyboardCode.Up || event.code === KeyboardCode.Down) event.preventDefault();
    return currentCoordinates;
  }
  event.preventDefault();
  const rects = context.droppableContainers
    .getEnabled()
    .map((container) => context.droppableRects.get(container.id))
    .filter((rect) => rect !== undefined)
    .sort((a, b) => a.left - b.left);
  const collision = context.collisionRect;
  if (rects.length === 0 || !collision) return currentCoordinates;
  const center = collision.left + collision.width / 2;
  let current = rects.findIndex((rect) => center >= rect.left && center <= rect.right);
  if (current < 0) current = rects.reduce((best, rect, index) => (Math.abs(rect.left - center) < Math.abs(rects[best].left - center) ? index : best), 0);
  const target = rects[current + (event.code === KeyboardCode.Right ? 1 : -1)];
  if (!target) return currentCoordinates;
  return { x: target.left + 12, y: Math.max(target.top + 56, currentCoordinates.y) };
};

type Override = { columnId: string; seq: number; pending: boolean };

export function Board<C extends BoardCard>({
  columns,
  cards,
  renderCard,
  onMove,
  emptyLabel = "Nenhum cartão aqui.",
  label = "Quadro",
  className,
}: BoardProps<C>) {
  const dndId = useId();
  const [overrides, setOverrides] = useState<Record<number, Override>>({});
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [visibleColumn, setVisibleColumn] = useState<string | null>(columns[0]?.id ?? null);
  const seq = useRef(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLElement | null>(null);
  /** Cartão cujo seletor deve receber foco depois de mudar de coluna (movimento feito pelo seletor). */
  const focusAfterMove = useRef<number | null>(null);

  // Quando o servidor manda dados novos (refresh), as posições confirmadas localmente deixam de ser necessárias.
  const signature = cards.map((card) => `${card.id}:${card.columnId}`).join("|");
  const [seenSignature, setSeenSignature] = useState(signature);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([, override]) => override.pending)));
  }

  const columnTitle = (id: string | null) => columns.find((column) => column.id === id)?.title ?? "";
  const cardName = (card: BoardCard | undefined) => card?.label?.trim() || (card ? `Cartão ${card.id}` : "Cartão");
  const columnOf = (card: BoardCard) => overrides[card.id]?.columnId ?? card.columnId;

  const grouped = new Map<string, C[]>(columns.map((column) => [column.id, []]));
  for (const card of cards) grouped.get(columnOf(card))?.push(card);
  // cartões recém-movidos ficam no topo da coluna de destino (o mais recente primeiro)
  for (const list of grouped.values()) {
    list.sort((a, b) => (overrides[b.id]?.seq ?? 0) - (overrides[a.id]?.seq ?? 0));
  }

  useEffect(() => {
    const id = focusAfterMove.current;
    if (id === null) return;
    focusAfterMove.current = null;
    const select = scrollerRef.current?.querySelector<HTMLElement>(`[data-card="${id}"] select`);
    select?.focus({ preventScroll: true });
    select?.closest("[data-card]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  // Celular: acompanha qual coluna está visível, para destacar a etiqueta correspondente.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setVisibleColumn((entry.target as HTMLElement).dataset.column ?? null);
        }
      },
      { root: scroller, threshold: 0.6 },
    );
    scroller.querySelectorAll("[data-column]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [columns.length]);

  // …e mantém essa etiqueta à vista na faixa de atalhos (rolagem só horizontal, sem mexer na página).
  useEffect(() => {
    const strip = chipsRef.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !chip) return;
    const left = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [visibleColumn]);

  async function move(card: C, toColumnId: string, via: "select" | "drag") {
    if (!columns.some((column) => column.id === toColumnId) || columnOf(card) === toColumnId) return;
    const mine = ++seq.current;
    const previous = overrides[card.id];
    setError(null);
    setOverrides((current) => ({ ...current, [card.id]: { columnId: toColumnId, seq: mine, pending: true } }));
    setAnnouncement(`${cardName(card)} movido para ${columnTitle(toColumnId)}.`);
    if (via === "select") focusAfterMove.current = card.id;

    let result: ActionState;
    try {
      result = await onMove(card.id, toColumnId);
    } catch {
      result = { ok: false, message: GENERIC_ERROR };
    }

    setOverrides((current) => {
      if (current[card.id]?.seq !== mine) return current; // já houve outro movimento do mesmo cartão
      const next = { ...current };
      if (result.ok) next[card.id] = { ...current[card.id], pending: false };
      else if (previous && !previous.pending) next[card.id] = previous;
      else delete next[card.id];
      return next;
    });
    if (!result.ok) {
      setError(result.message || GENERIC_ERROR);
      setAnnouncement("");
      if (via === "select") focusAfterMove.current = card.id; // o cartão voltou: o foco volta com ele
    }
  }

  const sensors = useSensors(
    useSensor(CardMouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnJump }),
  );

  const findCard = (id: unknown) => cards.find((card) => card.id === id);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${cardName(findCard(active.id))} selecionado. Use as setas para escolher a coluna.`,
    onDragOver: ({ over }) => (over ? `Sobre a coluna ${columnTitle(fromDropId(over.id))}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${cardName(findCard(active.id))} solto em ${columnTitle(fromDropId(over.id))}.` : "Movimento cancelado.",
    onDragCancel: () => "Movimento cancelado.",
  };

  const activeCard = activeId === null ? undefined : findCard(activeId);
  const body = (card: C) => (renderCard ? renderCard(card) : card.content);

  return (
    <section aria-label={label} className={className}>
      {error ? (
        <div role="alert" className="border-perigo/30 bg-perigo-claro text-perigo rounded-campo mb-3 flex items-start justify-between gap-3 border px-3 py-2 text-sm font-medium">
          <span className="py-1">{error}</span>
          <button type="button" className="btn btn-danger-ghost btn-icon btn-sm -mr-1 shrink-0" onClick={() => setError(null)} aria-label="Fechar aviso">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Celular: atalhos para as colunas, com contador */}
      <nav ref={chipsRef} aria-label={`Colunas de ${label}`} className="relative -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:hidden">
        {columns.map((column) => (
          <button
            key={column.id}
            type="button"
            aria-current={visibleColumn === column.id ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold",
              visibleColumn === column.id ? "border-detalhe bg-roxo text-white" : "border-borda-forte text-texto bg-superficie",
            )}
            onClick={() =>
              scrollerRef.current
                ?.querySelector(`[data-column="${column.id}"]`)
                ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
            }
          >
            {column.title}
            <span className={cn("tabular-nums", visibleColumn === column.id ? "text-lavanda" : "text-texto-suave")}>{grouped.get(column.id)?.length ?? 0}</span>
          </button>
        ))}
      </nav>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Para mover com o teclado: pressione espaço para pegar o cartão, use as setas esquerda e direita para escolher a coluna e espaço para soltar. Esc cancela. Ou use o seletor Mover para.",
          },
        }}
        onDragStart={({ active }) => {
          setActiveId(typeof active.id === "number" ? active.id : null);
          setError(null);
        }}
        onDragOver={({ over }) => setOverColumn(fromDropId(over?.id))}
        onDragCancel={() => {
          setActiveId(null);
          setOverColumn(null);
        }}
        onDragEnd={({ active, over }) => {
          setActiveId(null);
          setOverColumn(null);
          const card = findCard(active.id);
          const target = fromDropId(over?.id);
          if (card && target) void move(card, target, "drag");
        }}
      >
        <div
          ref={scrollerRef}
          className={cn(
            // `relative`: mantém os rótulos .sr-only (position: absolute) dentro da área de rolagem
            "relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-3 sm:mx-0 sm:snap-none sm:px-0",
            activeId !== null && "snap-none",
          )}
        >
          {columns.map((column) => {
            const list = grouped.get(column.id) ?? [];
            return (
              <BoardColumnView
                key={column.id}
                column={column}
                count={list.length}
                highlighted={activeId !== null && overColumn === column.id}
                emptyLabel={emptyLabel}
              >
                {list.map((card) => (
                  <BoardCardView
                    key={card.id}
                    card={card}
                    name={cardName(card)}
                    columns={columns}
                    currentColumnId={column.id}
                    pending={overrides[card.id]?.pending ?? false}
                    hidden={activeId === card.id}
                    onSelect={(toColumnId) => void move(card, toColumnId, "select")}
                  >
                    {body(card)}
                  </BoardCardView>
                ))}
              </BoardColumnView>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div className="border-detalhe shadow-flutuante rounded-campo w-[17rem] rotate-1 cursor-grabbing border bg-superficie p-3">{body(activeCard)}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}

function BoardColumnView({
  column,
  count,
  highlighted,
  emptyLabel,
  children,
}: {
  column: BoardColumn;
  count: number;
  highlighted: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnDropId(column.id) });
  const headingId = useId();
  return (
    <section
      ref={setNodeRef}
      data-column={column.id}
      aria-labelledby={headingId}
      className={cn(
        "rounded-cartao flex w-[84vw] max-w-80 shrink-0 snap-center flex-col border bg-white/60 transition-colors sm:max-h-[72vh] sm:w-72",
        highlighted ? "border-detalhe bg-detalhe-suave/70" : "border-borda",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", TONE_DOT[column.tone ?? "neutral"])} />
        <h3 id={headingId} className="text-texto min-w-0 flex-1 truncate text-sm font-bold">
          {column.title}
        </h3>
        <span className="bg-borda/70 text-texto min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums" aria-label={`${count} ${count === 1 ? "cartão" : "cartões"}`}>
          {count}
        </span>
      </header>
      {count === 0 ? (
        <p className="text-texto-suave border-borda-forte rounded-campo mx-2 mb-2 border border-dashed px-3 py-5 text-center text-[0.8125rem]">{emptyLabel}</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-2 px-2 pb-2 sm:overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}

function BoardCardView({
  card,
  name,
  columns,
  currentColumnId,
  pending,
  hidden,
  onSelect,
  children,
}: {
  card: BoardCard;
  name: string;
  columns: BoardColumn[];
  currentColumnId: string;
  pending: boolean;
  hidden: boolean;
  onSelect: (toColumnId: string) => void;
  children: ReactNode;
}) {
  const selectId = useId();
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useDraggable({ id: card.id, attributes: { roleDescription: "cartão arrastável" } });
  return (
    <li
      ref={setNodeRef}
      data-card={card.id}
      {...listeners}
      className={cn(
        "border-borda rounded-campo shadow-cartao hover:border-borda-forte relative cursor-grab touch-manipulation border bg-superficie transition-[opacity,border-color] select-none",
        hidden && "opacity-40",
        pending && "opacity-70",
      )}
    >
      <div className="flex items-start gap-1 p-3 pb-2">
        <div className="min-w-0 flex-1">{children}</div>
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          type="button"
          className="text-texto-suave hover:bg-detalhe-suave hover:text-detalhe -mt-1.5 -mr-2 hidden size-9 shrink-0 cursor-grab items-center justify-center rounded-md sm:inline-flex"
          aria-label={`Arrastar ${name}`}
          title="Arrastar (ou espaço e setas no teclado)"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="border-borda border-t px-1.5 py-1">
        <label className="sr-only" htmlFor={selectId}>{`Mover ${name} para outra coluna`}</label>
        <select
          id={selectId}
          value=""
          onChange={(event) => {
            if (event.target.value) onSelect(event.target.value);
          }}
          className="text-detalhe hover:bg-detalhe-suave focus-visible:bg-detalhe-suave min-h-11 w-full cursor-pointer appearance-none rounded-md bg-transparent px-1.5 text-base font-semibold sm:min-h-9 sm:text-[0.8125rem]"
        >
          <option value="" disabled>
            Mover para…
          </option>
          {columns
            .filter((column) => column.id !== currentColumnId)
            .map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
        </select>
      </div>
    </li>
  );
}
