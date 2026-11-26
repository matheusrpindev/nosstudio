"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = {
  name: string;
  label: string;
  /** `current-password` no login; `new-password` ao criar/trocar. */
  autoComplete: "current-password" | "new-password";
  hint?: string;
  autoFocus?: boolean;
};

/** Campo de senha com botão mostrar/ocultar (o botão não rouba o Tab do fluxo: fica depois do campo). */
export function PasswordField({ name, label, autoComplete, hint, autoFocus }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field name={name} label={label} hint={hint} required>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          maxLength={200}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="text-texto-suave hover:text-detalhe absolute inset-y-0 right-0 inline-flex w-11 cursor-pointer items-center justify-center rounded-r-campo"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </div>
    </Field>
  );
}
