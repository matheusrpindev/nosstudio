"use client";

/**
 * Lista de projetos do portfólio no painel. A ORDEM daqui é a ordem do site: arraste pela alça ou use as setas
 * (que também funcionam no teclado e no celular). Cada linha publica/despublica e marca o destaque na hora.
 * Com filtro ou busca aplicados a lista é parcial, então a reordenação fica desligada (`sortable = false`).
 */
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, ImageOff, Star } from "lucide-react";
import Link from "next/link";
import { Switch } from "radix-ui";
import { useId, useOptimistic, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

export type PortfolioRow = {
  id: number;
  title: string;
  categoryLabel: string;
  /** Nome do cliente guardado no painel ("" = sem cliente informado). */
  clientName: string;
  showClient: boolean;
  /** Data já formatada ("" = sem data). */
  date: string;
  published: boolean;
  featured: boolean;
  /** Experiência anterior de um fundador (não é trabalho da NÓS). */
  previous: boolean;
  coverUrl: string | null;
};

type Props = {
  rows: PortfolioRow[];
  canEdit: boolean;
  /** Falso quando a lista está filtrada: não dá para reordenar uma lista parcial. */
  sortable: boolean;
  moveAction: (id: number, direction: "up" | "down") => Promise<ActionState>;
  reorderAction: (order: number[]) => Promise<ActionState>;
  publishAction: (id: number, published: boolean) => Promise<ActionState>;
  featureAction: (id: number, featured: boolean) => Promise<ActionState>;
};

export function PortfolioList({ rows, canEdit, sortable, moveAction, reorderAction, publishAction, featureAction }: Props) {
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useOptimistic(rows);
  const [announcement, setAnnouncement] = useState("");
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const canSort = canEdit && sortable;

  function run(optimistic: PortfolioRow[], call: () => Promise<ActionState>) {
    startTransition(async () => {
      setItems(optimistic);
      try {
        const result = await call();
        if (result.message) {
          if (result.ok) toast(result.message);
          else toast.error(result.message);
        }
      } catch {
        toast.error("Não foi possível salvar. Confira a conexão e tente de novo.");
      }
    });
  }

  function move(id: number, direction: "up" | "down") {
    const from = items.findIndex((item) => item.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= items.length) return;
    setAnnouncement(`“${items[from].title}” agora é o ${to + 1}º de ${items.length}.`);
    run(arrayMove(items, from, to), () => moveAction(id, direction));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from === -1 || to === -1) return;
    const next = arrayMove(items, from, to);
    setAnnouncement(`“${items[from].title}” agora é o ${to + 1}º de ${items.length}.`);
    run(next, () => reorderAction(next.map((item) => item.id)));
  }

  const publish = (id: number, published: boolean) => run(items.map((item) => (item.id === id ? { ...item, published } : item)), () => publishAction(id, published));
  const feature = (id: number, featured: boolean) => run(items.map((item) => (item.id === id ? { ...item, featured } : item)), () => featureAction(id, featured));

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy} disabled={!canSort}>
        <ol className="space-y-2" aria-label={sortable ? "Projetos do portfólio, na ordem em que aparecem no site" : "Projetos do portfólio (lista filtrada)"} aria-busy={pending || undefined}>
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              position={sortable ? index + 1 : null}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              canEdit={canEdit}
              canSort={canSort}
              pending={pending}
              onMove={move}
              onPublish={publish}
              onFeature={feature}
            />
          ))}
        </ol>
      </SortableContext>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </DndContext>
  );
}

function Row({
  item,
  position,
  isFirst,
  isLast,
  canEdit,
  canSort,
  pending,
  onMove,
  onPublish,
  onFeature,
}: {
  item: PortfolioRow;
  position: number | null;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  canSort: boolean;
  pending: boolean;
  onMove: (id: number, direction: "up" | "down") => void;
  onPublish: (id: number, published: boolean) => void;
  onFeature: (id: number, featured: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canSort });
  const href = `/painel/site/portfolio/${item.id}`;
  const details = [item.categoryLabel, item.date].filter(Boolean).join(" · ");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-project={item.id}
      className={cn(
        "border-borda bg-superficie rounded-campo flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:gap-4",
        isDragging && "border-foco relative z-10 shadow-lg",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {canSort ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Arrastar “${item.title}” para mudar a ordem`}
            className="text-texto-suave hover:text-texto focus-visible:outline-foco -ml-1 hidden size-11 shrink-0 cursor-grab touch-none place-items-center rounded-md focus-visible:outline-2 active:cursor-grabbing sm:grid"
          >
            <GripVertical aria-hidden="true" className="size-5" />
          </button>
        ) : null}
        {position ? (
          <span aria-hidden="true" className="text-detalhe w-6 shrink-0 text-sm font-bold tabular-nums">
            {String(position).padStart(2, "0")}
          </span>
        ) : null}
        <span className="bg-detalhe-suave text-detalhe grid aspect-[4/3] w-16 shrink-0 place-items-center overflow-hidden rounded-md sm:w-20">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura do painel; o arquivo já vem otimizado pelo upload
            <img src={item.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <ImageOff aria-hidden="true" className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={href} className="text-texto hover:text-detalhe focus-visible:outline-foco rounded-sm text-base font-bold break-words focus-visible:outline-2">
              {item.title}
            </Link>
            <Badge tone={item.published ? "sucesso" : "neutral"} dot>
              {item.published ? "Publicado" : "Rascunho"}
            </Badge>
            {item.featured ? (
              <Badge tone="lima">
                <Star aria-hidden="true" className="size-3" /> Destaque
              </Badge>
            ) : null}
            {item.previous ? <Badge tone="roxo">Experiência anterior</Badge> : null}
            {!item.coverUrl ? <Badge tone="alerta">Sem capa</Badge> : null}
          </p>
          <p className="text-texto-suave mt-1 text-sm leading-relaxed">
            {details}
            {item.clientName ? (
              <>
                {details ? " · " : ""}
                {item.clientName}
                {item.showClient ? "" : " (nome não aparece no site)"}
              </>
            ) : null}
          </p>
        </div>
      </div>

      {canEdit ? (
        <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
          <span className="inline-flex items-center gap-1">
            <IconButton
              aria-label={item.featured ? `Tirar o destaque de “${item.title}”` : `Marcar “${item.title}” como destaque`}
              aria-pressed={item.featured}
              disabled={pending}
              onClick={() => onFeature(item.id, !item.featured)}
              className={item.featured ? "text-primaria" : undefined}
            >
              <Star fill={item.featured ? "currentColor" : "none"} />
            </IconButton>
            {canSort ? (
              <>
                <IconButton aria-label={`Subir “${item.title}”`} disabled={isFirst || pending} onClick={() => onMove(item.id, "up")}>
                  <ArrowUp />
                </IconButton>
                <IconButton aria-label={`Descer “${item.title}”`} disabled={isLast || pending} onClick={() => onMove(item.id, "down")}>
                  <ArrowDown />
                </IconButton>
              </>
            ) : null}
          </span>
          <Switch.Root
            checked={item.published}
            onCheckedChange={(next) => onPublish(item.id, next)}
            disabled={pending}
            aria-label={`Publicar “${item.title}” no site`}
            className="bg-borda-forte data-[state=checked]:bg-primaria relative ml-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Switch.Thumb className="block size-5.5 translate-x-[3px] rounded-full bg-white shadow-sm transition-[transform,background-color] data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-sobre-primaria" />
          </Switch.Root>
        </div>
      ) : null}
    </li>
  );
}
