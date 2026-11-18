"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { resetPasswordAction } from "@/lib/auth/actions";
import { PasswordField } from "../password-field";

export function ResetForm({ token, minLength }: { token: string; minLength: number }) {
  return (
    <div className="mt-8">
      <ActionForm action={resetPasswordAction} hidden={{ token }}>
        <PasswordField name="password" label="Nova senha" autoComplete="new-password" hint={`Pelo menos ${minLength} caracteres, com letras e números.`} autoFocus />
        <PasswordField name="confirm" label="Repita a nova senha" autoComplete="new-password" />
        <SubmitButton size="lg" block pendingLabel="Salvando…">
          Salvar nova senha
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/recuperar-senha" className="link">
          Pedir um novo link
        </Link>
      </p>
    </div>
  );
}
