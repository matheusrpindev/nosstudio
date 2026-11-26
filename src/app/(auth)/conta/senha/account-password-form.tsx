"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form";
import { changePasswordAction } from "@/lib/auth/actions";
import { PasswordField } from "../../password-field";

export function AccountPasswordForm({ minLength, forced }: { minLength: number; /** A conta ainda está com a senha provisória. */ forced: boolean }) {
  return (
    <div className="mt-6">
      <ActionForm action={changePasswordAction} resetOnSuccess>
        <PasswordField name="currentPassword" label={forced ? "Senha atual (a provisória)" : "Senha atual"} autoComplete="current-password" autoFocus />
        <PasswordField name="password" label="Nova senha" autoComplete="new-password" hint={`Pelo menos ${minLength} caracteres, com letras e números.`} />
        <PasswordField name="confirm" label="Repita a nova senha" autoComplete="new-password" />
        <SubmitButton size="lg" block pendingLabel="Salvando…">
          Salvar nova senha
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
