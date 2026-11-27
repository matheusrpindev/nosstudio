"use client";

/**
 * Lista das seções da página inicial: arrastar (ou as setas, que também funcionam no teclado e no celular) muda
 * a ordem; a chave liga/desliga. Cada mudança chama a Server Action e o site público é atualizado na hora.
 */
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Pencil } from "lucide-react";
import Link from "next/link";
import { Switch } from "radix-ui";
import { useId, useOptimistic, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { HomeSectionId } from "@/lib/site/home-layout";

export type SectionRow = {
  id: HomeSectionId;
  label: string;
  description: string;
  editHref: string;
  visible: boolean;
  /** A seção tem conteúdo publicado para mostrar agora? */
  hasContent: boolean;
  /** Por que não aparece, quando `hasContent` é falso. */
  emptyReason: string;
};

type Props = {
  rows: SectionRow[];
  canEdit: boolean;
  moveAction: (id: HomeSectionId, direction: "up" | "down") => Promise<ActionState>;
  reorderAction: (order: string[]) => Promise<ActionState>;
  toggleAction: (id: HomeSectionId, visible: boolean) => Promise<ActionState>;
};

export function SectionsEditor({ rows, canEdit, moveAction, reorderAction, toggleAction }: Props) {
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useOptimistic(rows);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function run(optimistic: SectionRow[], call: () => Promise<ActionState>) {
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

  function move(id: HomeSectionId, direction: "up" | "down") {
    const from = items.findIndex((item) => item.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= items.length) return;
    run(arrayMove(items, from, to), () => moveAction(id, direction));
  }

  function toggle(id: HomeSectionId, visible: boolean) {
    run(
      items.map((item) => (item.id === id ? { ...item, visible } : item)),
      () => toggleAction(id, visible),
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from === -1 || to === -1) return;
    const next = arrayMove(items, from, to);
    run(next, () => reorderAction(next.map((item) => item.id)));
  }

  // posição de cada seção entre as que realmente aparecem no site (para o "01", "02"…)
  let shown = 0;
  const positions = new Map<HomeSectionId, number>();
  for (const item of items) if (item.visible && item.hasContent) positions.set(item.id, ++shown);

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy} disabled={!canEdit}>
        <ol className="space-y-2" aria-label="Seções da página inicial, na ordem em que aparecem" aria-busy={pending || undefined}>
          {items.map((item, index) => (
            <SectionItem
              key={item.id}
              item={item}
              position={positions.get(item.id) ?? null}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              canEdit={canEdit}
              pending={pending}
              onMove={move}
              onToggle={toggle}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SectionItem({
  item,
  position,
  isFirst,
  isLast,
  canEdit,
  pending,
  onMove,
  onToggle,
}: {
  item: SectionRow;
  position: number | null;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  pending: boolean;
  onMove: (id: HomeSectionId, direction: "up" | "down") => void;
  onToggle: (id: HomeSectionId, visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });
  const status = !item.visible ? (
    <Badge tone="neutral">Oculta</Badge>
  ) : item.hasContent ? (
    <Badge tone="sucesso">No site</Badge>
  ) : (
    <Badge tone="alerta">Sem conteúdo: não aparece</Badge>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "border-borda bg-superficie rounded-campo flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
        isDragging && "border-foco relative z-10 shadow-lg",
        !item.visible && "opacity-75",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {canEdit ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Arrastar “${item.label}” para mudar a ordem`}
            className="text-texto-suave hover:text-texto focus-visible:outline-foco -ml-1 hidden size-11 shrink-0 cursor-grab touch-none place-items-center rounded-md focus-visible:outline-2 active:cursor-grabbing sm:grid"
          >
            <GripVertical aria-hidden="true" className="size-5" />
          </button>
        ) : null}
        <span aria-hidden="true" className="text-detalhe w-7 shrink-0 pt-0.5 text-sm font-bold tabular-nums">
          {position ? String(position).padStart(2, "0") : "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-texto flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold">
            {item.label}
            {status}
          </p>
          <p className="text-texto-suave mt-1 text-sm leading-relaxed">{item.visible && !item.hasContent ? item.emptyReason : item.description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
        <Link
          href={item.editHref}
          className="text-detalhe hover:text-texto focus-visible:outline-foco inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold focus-visible:outline-2"
          aria-label={`Editar o conteúdo de “${item.label}”`}
        >
          <Pencil aria-hidden="true" className="size-4" />
          Conteúdo
        </Link>
        {canEdit ? (
          <span className="inline-flex items-center gap-1">
            <IconButton aria-label={`Subir “${item.label}”`} disabled={isFirst || pending} onClick={() => onMove(item.id, "up")}>
              <ArrowUp />
            </IconButton>
            <IconButton aria-label={`Descer “${item.label}”`} disabled={isLast || pending} onClick={() => onMove(item.id, "down")}>
              <ArrowDown />
            </IconButton>
            <Switch.Root
              checked={item.visible}
              onCheckedChange={(next) => onToggle(item.id, next)}
              disabled={pending}
              aria-label={`Mostrar “${item.label}” na página inicial`}
              className="bg-borda-forte data-[state=checked]:bg-primaria relative ml-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Switch.Thumb className="block size-5.5 translate-x-[3px] rounded-full bg-white shadow-sm transition-[transform,background-color] data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-sobre-primaria" />
            </Switch.Root>
          </span>
        ) : null}
      </div>
    </li>
  );
}
