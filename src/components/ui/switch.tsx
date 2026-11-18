"use client";

import { Switch as RadixSwitch } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFieldState } from "./form";

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
  return (
    <div className={cn("flex min-h-11 items-start gap-3 py-2", className)}>
      <RadixSwitch.Root
        id={id}
        name={name}
        value="on"
        disabled={disabled}
        aria-describedby={hint ? `${id}-ajuda` : undefined}
        {...(checked !== undefined ? { checked } : { defaultChecked: initial })}
        onCheckedChange={onCheckedChange}
        className="bg-areia-escuro data-[state=checked]:bg-roxo relative mt-0.5 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-55"
      >
        <RadixSwitch.Thumb className="block size-5.5 translate-x-[3px] rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[23px]" />
      </RadixSwitch.Root>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-1 text-sm leading-snug">
        <span className="text-grafite font-medium">{label}</span>
        {hint ? (
          <span id={`${id}-ajuda`} className="text-cinza mt-0.5 block text-[0.8125rem]">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}
