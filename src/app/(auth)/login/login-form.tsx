"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/auth/actions";
import { PasswordField } from "../password-field";

type LoginFormProps = {
  /** Destino depois do login (já validado no servidor; a action valida de novo). */
  next: string;
  /** Veio de uma redefinição de senha concluída. */
  passwordReset: boolean;
};

export function LoginForm({ next, passwordReset }: LoginFormProps) {
  return (
    <div className="mt-8">
      {passwordReset ? (
        <Alert tone="sucesso" role="status" className="mb-5">
          Senha redefinida. Entre com a nova senha.
        </Alert>
      ) : null}
      <ActionForm action={loginAction} hidden={{ next: next || undefined }}>
        <Field name="email" label="E-mail" required>
          <Input type="email" autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus maxLength={160} />
        </Field>
        <PasswordField name="password" label="Senha" autoComplete="current-password" />
        <SubmitButton size="lg" block pendingLabel="Entrando…">
          Entrar
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/recuperar-senha" className="link">
          Esqueci minha senha
        </Link>
      </p>
    </div>
  );
}
