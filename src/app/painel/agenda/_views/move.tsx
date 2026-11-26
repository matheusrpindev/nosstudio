"use client";

import { Undo2, X } from "lucide-react";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { RadioCards } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { applyPlacements, samePlacement, type DragPlacement } from "@/lib/agenda/drag";
import { timeLabel, type AgendaItem } from "@/lib/agenda/view";
import { initialActionState } from "@/lib/action-state";
import { formatDate, formatDateLong, formatWeekday } from "@/lib/dates";
import { AGENDA_SERIES_SCOPE_LABELS, type AgendaSeriesScope } from "@/lib/domain";
import { moveEventAction, undoMoveEventAction, type MoveActionData } from "../actions";

type Mover = {
  /** A pessoa pode mover compromissos nesta tela? */
  enabled: boolean;
  /** Pede o movimento: pergunta da série (se for uma), atualização otimista, aviso de conflito e "Desfazer". */
  request: (item: AgendaItem, placement: DragPlacement) => void;
  /** Os itens com os movimentos ainda não confirmados já aplicados. */
  apply: (items: AgendaItem[]) => AgendaItem[];
};

const MoverContext = createContext<Mover>({ enabled: false, request: () => {}, apply: (items) => items });

export function useMover(): Mover {
  return use(MoverContext);
}

type Pending = { item: AgendaItem; placement: DragPlacement; scope: AgendaSeriesScope };
type Conflict = Pending & { data: MoveActionData };

const UNDO_VISIBLE_MS = 9000;

function describe(placement: DragPlacement): string {
  const day = `${formatWeekday(placement.date)}, ${formatDateLong(placement.date).replace(/ de \d{4}$/, "")}`;
  return placement.startTime ? `${day}, ${timeLabel(placement)}` : day;
}

/**
 * Envolve as visões que arrastam compromissos (dia, semana, mês). Guarda os movimentos pendentes, os dois
 * diálogos (série e conflito) e o aviso com "Desfazer". Quem não pode editar recebe `enabled: false` e nada arrasta.
 */
export function MoveProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [placements, setPlacements] = useState<ReadonlyMap<string, DragPlacement>>(new Map());
  const [ask, setAsk] = useState<Pending | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [undo, setUndo] = useState<{ token: string; text: string; n: number } | null>(null);
  const [busy, startTransition] = useTransition();
  const counter = useRef(0);

  const place = useCallback((key: string, placement: DragPlacement | null) => {
    setPlacements((current) => {
      const next = new Map(current);
      if (placement) next.set(key, placement);
      else next.delete(key);
      return next;
    });
  }, []);

  const run = useCallback(
    (pending: Pending, ignoreConflicts: boolean) => {
      const { item, placement, scope } = pending;
      place(item.key, placement);
      startTransition(async () => {
        const data = new FormData();
        data.set("id", String(item.id));
        data.set("occurrence", item.date);
        data.set("scope", scope);
        data.set("date", placement.date);
        if (placement.startTime) data.set("startTime", placement.startTime);
        if (placement.endTime) data.set("endTime", placement.endTime);
        if (ignoreConflicts) data.set("ignoreConflicts", "1");
        let result: Awaited<ReturnType<typeof moveEventAction>>;
        try {
          result = await moveEventAction(initialActionState, data);
        } catch {
          place(item.key, null);
          toast.error("Não foi possível mover o compromisso. Confira a conexão e tente de novo.");
          return;
        }
        if (result.ok) {
          // a resposta da action já traz a agenda atualizada: o movimento otimista sai junto, sem piscar
          place(item.key, null);
          if (result.data?.undo) {
            counter.current += 1;
            setUndo({ token: result.data.undo, text: `Movido para ${describe(placement)}.`, n: counter.current });
          }
          return;
        }
        if (result.data?.conflicts?.length) {
          setConflict({ ...pending, data: result.data });
          return;
        }
        place(item.key, null);
        toast.error(result.message ?? "Não foi possível mover o compromisso.");
      });
    },
    [place],
  );

  const request = useCallback(
    (item: AgendaItem, placement: DragPlacement) => {
      if (!enabled || samePlacement(item, placement)) return;
      setUndo(null);
      if (item.seriesStart !== null) {
        place(item.key, placement);
        setAsk({ item, placement, scope: "este" });
      } else run({ item, placement, scope: "este" }, false);
    },
    [enabled, place, run],
  );

  const undoNow = useCallback(() => {
    if (!undo) return;
    const token = undo.token;
    setUndo(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("undo", token);
      try {
        const result = await undoMoveEventAction(initialActionState, data);
        if (result.ok) toast(result.message ?? "Movimento desfeito.");
        else toast.error(result.message ?? "Não foi possível desfazer.");
      } catch {
        toast.error("Não foi possível desfazer. Confira a conexão e tente de novo.");
      }
    });
  }, [undo]);

  // o aviso de "Desfazer" some sozinho
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo((current) => (current?.n === undo.n ? null : current)), UNDO_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const value = useMemo<Mover>(() => ({ enabled, request, apply: (items) => applyPlacements(items, placements) }), [enabled, request, placements]);

  const cancelAsk = () => {
    if (ask) place(ask.item.key, null);
    setAsk(null);
  };
  const cancelConflict = () => {
    if (conflict) place(conflict.item.key, null);
    setConflict(null);
  };

  return (
    <MoverContext value={value}>
      <div aria-busy={busy || undefined} className="contents">
        {children}
      </div>

      {/* série: a quem se aplica o movimento */}
      <Dialog
        open={ask !== null}
        onOpenChange={(open) => (open ? null : cancelAsk())}
        title="Mover compromisso que se repete"
        description={ask ? `“${ask.item.title}” vai para ${describe(ask.placement)}.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={cancelAsk}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!ask) return;
                const pending = ask;
                setAsk(null);
                run(pending, false);
              }}
            >
              Mover
            </Button>
          </>
        }
      >
        {ask ? (
          <fieldset>
            <legend className="label">Aplicar a</legend>
            <RadioCards
              name="escopo-mover"
              cols={1}
              compact
              className="!grid-cols-1"
              value={ask.scope}
              onValueChange={(scope) => setAsk({ ...ask, scope: scope as AgendaSeriesScope })}
              options={[
                { value: "este", label: AGENDA_SERIES_SCOPE_LABELS.este },
                { value: "seguintes", label: AGENDA_SERIES_SCOPE_LABELS.seguintes, disabled: ask.item.date === ask.item.seriesStart },
                { value: "todos", label: AGENDA_SERIES_SCOPE_LABELS.todos },
              ]}
            />
          </fieldset>
        ) : null}
      </Dialog>

      {/* conflito de horários: avisa, não proíbe */}
      <Dialog
        open={conflict !== null}
        onOpenChange={(open) => (open ? null : cancelConflict())}
        title={conflict && (conflict.data.total ?? 0) > 1 ? `${conflict.data.total} conflitos de horário` : "Conflito de horário"}
        description={conflict ? `Mover “${conflict.item.title}” para ${describe(conflict.placement)} choca com o que já está marcado.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={cancelConflict}>
              Não mover
            </Button>
            <Button
              onClick={() => {
                if (!conflict) return;
                const pending = conflict;
                setConflict(null);
                run(pending, true);
              }}
            >
              Mover mesmo assim
            </Button>
          </>
        }
      >
        {conflict ? (
          <Alert tone="alerta">
            <p>As pessoas abaixo já têm compromisso nesse horário:</p>
            <ul className="mt-2 space-y-1">
              {(conflict.data.conflicts ?? []).map((entry, index) => (
                <li key={index} className="flex flex-wrap gap-x-2">
                  <span className="font-semibold tabular-nums">
                    {formatDate(entry.date)} · {entry.startTime ? `${entry.startTime}${entry.endTime ? ` – ${entry.endTime}` : ""}` : "dia inteiro"}
                  </span>
                  <span className="min-w-0 break-words">
                    {entry.title}
                    {entry.people.length ? ` — ${entry.people.join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {(conflict.data.total ?? 0) > (conflict.data.conflicts?.length ?? 0) ? (
              <p className="text-texto-suave mt-1">…e mais {(conflict.data.total ?? 0) - (conflict.data.conflicts?.length ?? 0)}.</p>
            ) : null}
          </Alert>
        ) : null}
      </Dialog>

      {/* aviso com "Desfazer" (o kit de toasts não tem botão de ação: este é da agenda) */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[71] flex justify-center px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:px-0 print:hidden">
        {undo ? (
          <div
            key={undo.n}
            data-desfazer
            className="toast-entrada shadow-flutuante border-borda-forte pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-campo border bg-superficie-alta py-1.5 pr-1.5 pl-4 text-sm font-medium text-white"
          >
            <p className="min-w-0 flex-1 py-1.5 leading-snug">{undo.text}</p>
            <button type="button" onClick={undoNow} className="text-lima hover:bg-white/10 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 font-bold">
              <Undo2 aria-hidden="true" className="size-4" />
              Desfazer
            </button>
            <button type="button" onClick={() => setUndo(null)} aria-label="Fechar aviso" className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-white/10">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </MoverContext>
  );
}
