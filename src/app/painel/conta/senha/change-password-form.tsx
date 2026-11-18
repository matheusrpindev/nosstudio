"use client";

import { ButtonLink } from "@/components/ui/button";
import { ActionForm, FormActions, SubmitButton } from "@/components/ui/form";
import { changePasswordAction } from "@/lib/auth/actions";
import { PasswordField } from "@/app/(auth)/password-field";

export function ChangePasswordForm({ minLength }: { minLength: number }) {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess>
      <PasswordField name="currentPassword" label="Senha atual" autoComplete="current-password" />
      <PasswordField name="password" label="Nova senha" autoComplete="new-password" hint={`Pelo menos ${minLength} caracteres, com letras e números.`} />
      <PasswordField name="confirm" label="Repita a nova senha" autoComplete="new-password" />
      <FormActions>
        <SubmitButton pendingLabel="Salvando…">Salvar nova senha</SubmitButton>
        <ButtonLink href="/painel/conta" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
