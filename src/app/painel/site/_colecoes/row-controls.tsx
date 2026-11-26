"use client";

/**
 * Controles de linha das listas do editor do site (liga/desliga e subir/descer).
 * Chamam Server Actions direto (com o id) e mostram o resultado num toast; a própria action faz `refresh()`.
 */
import { ArrowDown, ArrowUp } from "lucide-react";
import { Switch } from "radix-ui";
import { useOptimistic, useTransition } from "react";
import { IconButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";

export type ToggleAction = (id: number, value: boolean) => Promise<ActionState>;
export type MoveAction = (id: number, direction: "up" | "down") => Promise<ActionState>;

/** Liga/desliga compacto para a lista. `label` descreve a ação para leitor de tela ("Mostrar no site"). */
export function RowSwitch({ id, checked, label, action, disabled }: { id: number; checked: boolean; label: string; action: ToggleAction; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(checked);

  function change(next: boolean) {
    startTransition(async () => {
      setValue(next);
      try {
        const result = await action(id, next);
        if (result.message) {
          if (result.ok) toast(result.message);
          else toast.error(result.message);
        }
      } catch {
        toast.error("Não foi possível salvar. Confira a conexão e tente de novo.");
      }
    });
  }

  return (
    <Switch.Root
      checked={value}
      onCheckedChange={change}
      disabled={disabled || pending}
      aria-label={label}
      className="bg-borda-forte data-[state=checked]:bg-primaria relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55"
    >
      <Switch.Thumb className="block size-5.5 translate-x-[3px] rounded-full bg-white shadow-sm transition-[transform,background-color] data-[state=checked]:bg-sobre-primaria data-[state=checked]:translate-x-[23px]" />
    </Switch.Root>
  );
}

/** Setas para subir e descer um item na ordem de exibição. */
export function MoveButtons({ id, name, isFirst, isLast, action }: { id: number; name: string; isFirst: boolean; isLast: boolean; action: MoveAction }) {
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      try {
        const result = await action(id, direction);
        if (!result.ok && result.message) toast.error(result.message);
      } catch {
        toast.error("Não foi possível mudar a ordem. Tente de novo.");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <IconButton aria-label={`Subir “${name}”`} disabled={isFirst || pending} onClick={() => move("up")}>
        <ArrowUp />
      </IconButton>
      <IconButton aria-label={`Descer “${name}”`} disabled={isLast || pending} onClick={() => move("down")}>
        <ArrowDown />
      </IconButton>
    </span>
  );
}
