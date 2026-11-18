"use client";

import { useState } from "react";
import { Field, useFieldContext } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";

/** Limite de referência do Instagram; a NÓS não publica pelo painel, então é só um aviso. */
const INSTAGRAM_LIMIT = 2200;

function CaptionTextarea({ defaultValue }: { defaultValue: string }) {
  const field = useFieldContext();
  const [length, setLength] = useState((field?.value ?? defaultValue).length);
  const over = length > INSTAGRAM_LIMIT;
  return (
    <>
      <Textarea rows={5} maxLength={5000} defaultValue={defaultValue} onInput={(event) => setLength(event.currentTarget.value.length)} />
      <p className={over ? "text-alerta mt-1 text-[0.8125rem] font-semibold" : "text-cinza mt-1 text-[0.8125rem]"} aria-live="polite">
        {length.toLocaleString("pt-BR")} {length === 1 ? "caractere" : "caracteres"}
        {over ? " — passou do limite de 2.200 do Instagram" : " · o Instagram aceita até 2.200"}
      </p>
    </>
  );
}

export function CaptionField({ defaultValue }: { defaultValue: string }) {
  return (
    <Field name="caption" label="Legenda" optional>
      <CaptionTextarea defaultValue={defaultValue} />
    </Field>
  );
}
