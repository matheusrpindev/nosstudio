"use client";

import { Plus, Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { IconButton } from "@/components/ui/button";
import { ActionForm, Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import type { ChecklistItem } from "@/db/schema";
import { addChecklistItemAction, removeChecklistItemAction, toggleChecklistItemAction } from "../actions";

type Change = { type: "toggle"; id: string; done: boolean } | { type: "remove"; id: string };

/** Checklist do projeto: marcar e remover gravam na hora (Server Action) com atualização otimista. */
export function Checklist({ projectId, items }: { projectId: number; items: ChecklistItem[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(items, (state, change: Change) =>
    change.type === "remove" ? state.filter((item) => item.id !== change.id) : state.map((item) => (item.id === change.id ? { ...item, done: change.done } : item)),
  );
  const done = optimistic.filter((item) => item.done).length;

  const run = (change: Change, action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      apply(change);
      try {
        const result = await action();
        if (!result.ok) toast.error(result.message ?? "Não foi possível salvar. Tente de novo.");
      } catch {
        toast.error("Não foi possível salvar. Confira a conexão e tente de novo.");
      }
    });

  return (
    <div>
      {optimistic.length > 0 ? (
        <>
          <p className="text-cinza mb-2 text-sm" aria-live="polite">
            <span className="tabular-nums">
              {done} de {optimistic.length}
            </span>{" "}
            concluídos
          </p>
          <ul className="divide-areia divide-y">
            {optimistic.map((item) => (
              <li key={item.id} className="flex items-center gap-1">
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 py-1 pr-2">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={item.done}
                    onChange={(event) => run({ type: "toggle", id: item.id, done: event.target.checked }, () => toggleChecklistItemAction(projectId, item.id, event.target.checked))}
                  />
                  <span className={item.done ? "text-cinza break-words line-through" : "text-grafite break-words"}>{item.text}</span>
                </label>
                <IconButton aria-label={`Remover "${item.text}"`} variant="danger-ghost" onClick={() => run({ type: "remove", id: item.id }, () => removeChecklistItemAction(projectId, item.id))}>
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-cinza mb-3 text-sm">Nenhum item ainda. Liste o que precisa acontecer até a entrega (ex.: “Receber briefing”, “Alinhar roteiro”, “Enviar para revisão”).</p>
      )}

      <ActionForm action={addChecklistItemAction} hidden={{ id: projectId }} resetOnSuccess success="none" className="mt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field name="text" label="Novo item do checklist" hideLabel>
            <Input maxLength={200} placeholder="Novo item do checklist" />
          </Field>
        </div>
        <SubmitButton variant="secondary" icon={<Plus />} pendingLabel="Adicionando…" className="shrink-0">
          Adicionar
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
