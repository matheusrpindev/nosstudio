"use client";

import Link from "next/link";
import { Alert, type AlertTone } from "@/components/ui/alert";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/auth/actions";
import { PasswordField } from "../password-field";

/** Aviso acima do formulário (senha redefinida, conta criada pelo convite…). O texto é escolhido no servidor. */
export type LoginNotice = { tone: AlertTone; text: string };

type LoginFormProps = {
  /** Destino depois do login (já validado no servidor; a action valida de novo). */
  next: string;
  notice: LoginNotice | null;
};

export function LoginForm({ next, notice }: LoginFormProps) {
  return (
    <div className="mt-8">
      {notice ? (
        <Alert tone={notice.tone} role="status" className="mb-5">
          {notice.text}
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
