"use client";

import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export function RecoverForm() {
  return (
    // A resposta é sempre a mesma, exista ou não a conta — por isso a confirmação fica na própria tela.
    <ActionForm action={requestPasswordResetAction} success="inline" className="mt-8">
      <Field name="email" label="E-mail" required>
        <Input type="email" autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus maxLength={160} />
      </Field>
      <SubmitButton size="lg" block pendingLabel="Enviando…">
        Enviar link de redefinição
      </SubmitButton>
    </ActionForm>
  );
}
