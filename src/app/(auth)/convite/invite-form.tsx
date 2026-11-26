"use client";

import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { acceptInviteAction } from "@/server/access/invite-actions";
import { PasswordField } from "../password-field";

/** Nome + senha de quem aceitou o convite. O e-mail é o do convite (não dá para trocar: o link é pessoal). */
export function InviteForm({ token, email, name, minLength }: { token: string; email: string; name: string; minLength: number }) {
  return (
    <div className="mt-6">
      <ActionForm action={acceptInviteAction} hidden={{ token, email }}>
        <Field name="emailShown" label="E-mail (seu login)" hint="É com este e-mail que você vai entrar.">
          <Input type="email" value={email} readOnly autoComplete="username" className="text-texto-suave" />
        </Field>
        <Field name="name" label="Seu nome" required>
          <Input defaultValue={name} maxLength={120} autoComplete="name" autoFocus={!name} />
        </Field>
        <PasswordField name="password" label="Crie uma senha" autoComplete="new-password" hint={`Pelo menos ${minLength} caracteres, com letras e números.`} autoFocus={Boolean(name)} />
        <PasswordField name="confirm" label="Repita a senha" autoComplete="new-password" />
        <SubmitButton size="lg" block pendingLabel="Criando a conta…">
          Criar minha conta
        </SubmitButton>
      </ActionForm>
      <p className="text-texto-suave mt-6 text-center text-sm leading-relaxed">Não esperava este convite? É só fechar esta página: nenhuma conta é criada.</p>
    </div>
  );
}
