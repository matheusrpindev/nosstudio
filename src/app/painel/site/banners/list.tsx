"use client";

/**
 * Lista dos banners do carrossel, na ordem em que aparecem: arrastar (ou as setas, que também funcionam no
 * teclado e no celular) muda a ordem; a chave liga/desliga; "Duplicar" cria uma cópia desligada.
 * Cada mudança chama a Server Action e o site público é atualizado na hora.
 */
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Switch } from "radix-ui";
import { useId, useOptimistic, useTransition, type ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { FormAction } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { BannerStatus, BannerView } from "@/lib/site/banners";
import { BannerPreview } from "./preview";

export type BannerRow = {
  id: number;
  name: string;
  layoutLabel: string;
  view: BannerView;
  enabled: boolean;
  status: BannerStatus;
  /** "De 1/12 às 08:00 até…" */
  period: string;
  durationSeconds: number;
  warnings: string[];
};

const STATUS: Record<BannerStatus, { label: string; tone: BadgeTone }> = {
  no_ar: { label: "No ar agora", tone: "sucesso" },
  agendado: { label: "Agendado", tone: "roxo" },
  encerrado: { label: "Período encerrado", tone: "alerta" },
  incompleto: { label: "Ligado, mas incompleto: não aparece", tone: "alerta" },
  desligado: { label: "Desligado", tone: "neutral" },
};

type Props = {
  rows: BannerRow[];
  canEdit: boolean;
  canDelete: boolean;
  eyebrow: string;
  /** O Ó do logo (Server Component), repassado às miniaturas. */
  symbol: ReactNode;
  moveAction: (id: number, direction: "up" | "down") => Promise<ActionState>;
  reorderAction: (order: number[]) => Promise<ActionState>;
  toggleAction: (id: number, enabled: boolean) => Promise<ActionState>;
  duplicateAction: (id: number) => Promise<ActionState>;
  deleteAction: FormAction;
};

export function BannerList({ rows, canEdit, canDelete, eyebrow, symbol, moveAction, reorderAction, toggleAction, duplicateAction, deleteAction }: Props) {
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useOptimistic(rows);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function run(optimistic: BannerRow[] | null, call: () => Promise<ActionState>) {
    startTransition(async () => {
      if (optimistic) setItems(optimistic);
      try {
        const result = await call();
        if (result?.message) {
          if (result.ok) toast(result.message);
          else toast.error(result.message);
        }
      } catch (error) {
        // `redirect()` de uma Server Action chega aqui como exceção de navegação: deixa o Next seguir
        if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
        toast.error("Não foi possível salvar. Confira a conexão e tente de novo.");
      }
    });
  }

  function move(id: number, direction: "up" | "down") {
    const from = items.findIndex((item) => item.id === id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= items.length) return;
    run(arrayMove(items, from, to), () => moveAction(id, direction));
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

  // posição de cada banner entre os que estão no ar (o "1 de 4" do site)
  let shown = 0;
  const positions = new Map<number, number>();
  for (const item of items) if (item.status === "no_ar") positions.set(item.id, ++shown);

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy} disabled={!canEdit}>
        <ol className="space-y-3" aria-label="Banners, na ordem em que aparecem no carrossel" aria-busy={pending || undefined}>
          {items.map((item, index) => (
            <BannerItem
              key={item.id}
              item={item}
              position={positions.get(item.id) ?? null}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              canEdit={canEdit}
              canDelete={canDelete}
              pending={pending}
              eyebrow={eyebrow}
              symbol={symbol}
              onMove={move}
              onToggle={(id, enabled) =>
                run(
                  items.map((row) => (row.id === id ? { ...row, enabled } : row)),
                  () => toggleAction(id, enabled),
                )
              }
              onDuplicate={(id) => run(null, () => duplicateAction(id))}
              deleteAction={deleteAction}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function BannerItem({
  item,
  position,
  isFirst,
  isLast,
  canEdit,
  canDelete,
  pending,
  eyebrow,
  symbol,
  onMove,
  onToggle,
  onDuplicate,
  deleteAction,
}: {
  item: BannerRow;
  position: number | null;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  canDelete: boolean;
  pending: boolean;
  eyebrow: string;
  symbol: ReactNode;
  onMove: (id: number, direction: "up" | "down") => void;
  onToggle: (id: number, enabled: boolean) => void;
  onDuplicate: (id: number) => void;
  deleteAction: FormAction;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });
  const status = STATUS[item.status];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("border-borda bg-superficie rounded-campo border p-3 sm:p-4", isDragging && "border-foco relative z-10 shadow-lg", !item.enabled && "opacity-80")}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex min-w-0 items-start gap-2 md:w-72 md:shrink-0">
          {canEdit ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Arrastar “${item.name}” para mudar a ordem`}
              className="text-texto-suave hover:text-texto focus-visible:outline-foco -ml-1 hidden size-11 shrink-0 cursor-grab touch-none place-items-center rounded-md focus-visible:outline-2 active:cursor-grabbing sm:grid"
            >
              <GripVertical aria-hidden="true" className="size-5" />
            </button>
          ) : null}
          <BannerPreview banner={item.view} viewport="desktop" eyebrow={eyebrow} symbol={symbol} className="min-w-0 flex-1" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-texto flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold">
            <span aria-hidden="true" className="text-detalhe text-sm tabular-nums">
              {position ? String(position).padStart(2, "0") : "—"}
            </span>
            <span className="break-words">{item.name}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            <span className="text-texto-suave text-[0.8125rem]">
              {item.layoutLabel} · {item.durationSeconds} s
            </span>
          </div>
          <p className="text-texto-suave mt-1 text-[0.8125rem]">{item.period}</p>
          {item.warnings.length > 0 ? (
            <ul className="text-alerta mt-2 list-disc space-y-1 pl-4 text-[0.8125rem] leading-snug">
              {item.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1 md:max-w-[15rem] md:justify-end">
          {canEdit ? (
            <>
              <Switch.Root
                checked={item.enabled}
                onCheckedChange={(next) => onToggle(item.id, next)}
                disabled={pending}
                aria-label={`Banner “${item.name}” ligado`}
                className="bg-borda-forte data-[state=checked]:bg-primaria relative mr-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Switch.Thumb className="block size-5.5 translate-x-[3px] rounded-full bg-white shadow-sm transition-[transform,background-color] data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-sobre-primaria" />
              </Switch.Root>
              <IconButton aria-label={`Subir “${item.name}”`} disabled={isFirst || pending} onClick={() => onMove(item.id, "up")}>
                <ArrowUp />
              </IconButton>
              <IconButton aria-label={`Descer “${item.name}”`} disabled={isLast || pending} onClick={() => onMove(item.id, "down")}>
                <ArrowDown />
              </IconButton>
              <IconButton aria-label={`Duplicar “${item.name}”`} disabled={pending} onClick={() => onDuplicate(item.id)}>
                <Copy />
              </IconButton>
              {canDelete ? (
                <ConfirmDialog
                  trigger={
                    <IconButton aria-label={`Excluir “${item.name}”`} disabled={pending}>
                      <Trash2 />
                    </IconButton>
                  }
                  title={`Excluir o banner “${item.name}”?`}
                  description="Ele sai do carrossel e não dá para recuperar. Para só tirar do ar por um tempo, desligue o banner em vez de excluir."
                  confirmLabel="Excluir banner"
                  action={deleteAction}
                  hidden={{ id: item.id }}
                />
              ) : null}
              <ButtonLink href={`/painel/site/banners/${item.id}`} variant="secondary" icon={<Pencil />}>
                Editar
              </ButtonLink>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Botão "Duplicar" da tela de edição. */
export function DuplicateButton({ id, action }: { id: number; action: (id: number) => Promise<ActionState> }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      icon={<Copy />}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action(id);
          if (result && !result.ok && result.message) toast.error(result.message);
        })
      }
    >
      Duplicar
    </Button>
  );
}
