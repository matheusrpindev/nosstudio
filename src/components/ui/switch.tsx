"use client";

import { Switch as RadixSwitch } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useActionFormState, useFieldState } from "./form";

export type SwitchProps = {
  /** Enviado como `"on"` quando ligado (no schema: `f.checkbox()`). */
  name?: string;
  label: ReactNode;
  hint?: ReactNode;
  defaultChecked?: boolean;
  /** Modo controlado. */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/** Liga/desliga com rótulo (ex.: "Publicado no site"). Linha inteira clicável. */
export function Switch({ name, label, hint, defaultChecked, checked, onCheckedChange, disabled, className }: SwitchProps) {
  const id = useId();
  const state = useFieldState(name);
  const initial = state.submitted ? state.value !== undefined : defaultChecked;
  // O Radix guarda o estado inicial e volta para ele quando o React reseta o formulário depois da action.
  // Remontar a cada resposta faz o switch nascer já com o valor certo (o que foi enviado, ou o novo padrão).
  const responseKey = useActionFormState()?.state.nonce ?? "inicial";
  return (
    <div className={cn("flex min-h-11 items-start gap-3 py-2", className)}>
      <RadixSwitch.Root
        key={responseKey}
        id={id}
        name={name}
        value="on"
        disabled={disabled}
        aria-describedby={hint ? `${id}-ajuda` : undefined}
        {...(checked !== undefined ? { checked } : { defaultChecked: initial })}
        onCheckedChange={onCheckedChange}
        className="bg-borda-forte data-[state=checked]:bg-roxo relative mt-0.5 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55"
      >
        <RadixSwitch.Thumb className="block size-5.5 translate-x-[3px] rounded-full bg-superficie shadow-sm transition-transform data-[state=checked]:translate-x-[23px]" />
      </RadixSwitch.Root>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-1 text-sm leading-snug">
        <span className="text-texto font-medium">{label}</span>
        {hint ? (
          <span id={`${id}-ajuda`} className="text-texto-suave mt-0.5 block text-[0.8125rem]">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}
