"use client";

import { Check, Copy, KeyRound, Pencil, Plus, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, RadioCards } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/domain";
import { createUserAction, resetUserPasswordAction, setUserActiveAction, updateUserAction, type TemporaryCredentials } from "./actions";

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ...USER_ROLE_DESCRIPTIONS,
  admin: "Acesso completo, inclusive gerenciar contas, exportar dados e ver a auditoria. É o perfil dos sócios.",
  tecnico: "Conta do desenvolvedor para dar suporte. Acessa o painel, mas não gerencia contas nem exporta dados. É temporária: revogue quando o suporte acabar.",
};

const roleOptions = (disabled?: boolean) => USER_ROLES.map((role) => ({ value: role, label: USER_ROLE_LABELS[role], description: ROLE_DESCRIPTIONS[role], disabled }));

/** A senha temporária, mostrada uma única vez, com botão de copiar. */
function TemporaryPasswordPanel({ credentials, intro, onDone }: { credentials: TemporaryCredentials; intro: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      toast("Senha copiada.");
    } catch {
      toast.error("Não consegui copiar. Selecione a senha e copie à mão.");
    }
  }

  return (
    <div className="space-y-4">
      <Alert tone="alerta" title="Anote agora: esta senha não aparece de novo">
        {intro} Entregue a senha direto à pessoa (pessoalmente ou por mensagem privada). No primeiro acesso, o painel pede uma senha nova. Se perder, é só gerar outra.
      </Alert>
      <dl className="bg-superficie-alta rounded-campo space-y-3 p-4 text-sm">
        <div>
          <dt className="text-texto-suave text-xs font-semibold tracking-wide uppercase">Conta</dt>
          <dd className="text-texto font-semibold break-words">{credentials.name}</dd>
          <dd className="text-texto-suave break-all">{credentials.email}</dd>
        </div>
        <div>
          <dt className="text-texto-suave text-xs font-semibold tracking-wide uppercase">Senha temporária</dt>
          <dd>
            <output data-testid="senha-temporaria" className="text-texto block font-mono text-xl font-bold tracking-wider break-all select-all">
              {credentials.password}
            </output>
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={copy}>
          {copied ? "Copiada" : "Copiar senha"}
        </Button>
        <Button onClick={onDone}>Já anotei, concluir</Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ nova conta
export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(null);

  function change(next: boolean) {
    setOpen(next);
    if (!next) setCredentials(null); // ao fechar, a senha some da tela
  }

  return (
    <Dialog
      open={open}
      onOpenChange={change}
      trigger={<Button icon={<Plus />}>Nova conta</Button>}
      title={credentials ? "Conta criada" : "Nova conta"}
      description={credentials ? undefined : "A pessoa recebe uma senha temporária e define a própria senha no primeiro acesso."}
    >
      {credentials ? (
        <TemporaryPasswordPanel credentials={credentials} intro="A conta já pode entrar no painel." onDone={() => change(false)} />
      ) : (
        <ActionForm action={createUserAction} onSuccess={(state) => setCredentials(state.data ?? null)} success="none">
          <Field name="name" label="Nome" required>
            <Input maxLength={120} autoComplete="off" />
          </Field>
          <Field name="email" label="E-mail" required hint="É o login da pessoa. Vale também para recuperar a senha.">
            <Input type="email" maxLength={160} autoComplete="off" inputMode="email" />
          </Field>
          <Field name="role" label="Perfil" group required>
            <RadioCards name="role" cols={1} defaultValue="admin" options={roleOptions()} />
          </Field>
          <FormActions>
            <SubmitButton pendingLabel="Criando…">Criar conta</SubmitButton>
            <Button variant="ghost" onClick={() => change(false)}>
              Cancelar
            </Button>
          </FormActions>
        </ActionForm>
      )}
    </Dialog>
  );
}

// --------------------------------------------------------- ações de cada conta
export type UserActionsProps = {
  user: { id: number; name: string; email: string; role: UserRole; active: boolean };
  isSelf: boolean;
};

function EditDialog({ user, isSelf }: UserActionsProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen} trigger={<Button variant="secondary" icon={<Pencil />} aria-label={`Editar ${user.name}`}>Editar</Button>} title="Editar conta" description={user.email}>
      <ActionForm action={updateUserAction} hidden={{ id: user.id }} onSuccess={() => setOpen(false)}>
        <Field name="name" label="Nome" required>
          <Input defaultValue={user.name} maxLength={120} />
        </Field>
        <Field name="email" label="E-mail" required hint="Mudar o e-mail encerra as sessões abertas desta conta.">
          <Input type="email" defaultValue={user.email} maxLength={160} inputMode="email" />
        </Field>
        <Field name="role" label="Perfil" group required hint={isSelf ? "Você não pode mudar o seu próprio perfil." : "Mudar o perfil encerra as sessões abertas desta conta."}>
          <RadioCards name="role" cols={1} defaultValue={user.role} options={roleOptions(isSelf)} />
        </Field>
        {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}
        <FormActions>
          <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </FormActions>
      </ActionForm>
    </Dialog>
  );
}

function ResetPasswordDialog({ user }: UserActionsProps) {
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(null);

  function change(next: boolean) {
    setOpen(next);
    if (!next) setCredentials(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={change}
      trigger={<Button variant="secondary" icon={<KeyRound />} aria-label={`Redefinir a senha de ${user.name}`}>Nova senha</Button>}
      title={credentials ? "Nova senha gerada" : "Redefinir a senha?"}
      description={credentials ? undefined : `Vamos gerar uma senha temporária para ${user.name}. A senha antiga deixa de valer e a pessoa é desconectada de todos os aparelhos.`}
    >
      {credentials ? (
        <TemporaryPasswordPanel credentials={credentials} intro="A senha antiga já não vale e as sessões abertas foram encerradas." onDone={() => change(false)} />
      ) : (
        <ActionForm action={resetUserPasswordAction} hidden={{ id: user.id }} onSuccess={(state) => setCredentials(state.data ?? null)} success="none">
          <FormActions>
            <SubmitButton pendingLabel="Gerando…">Gerar nova senha</SubmitButton>
            <Button variant="ghost" onClick={() => change(false)}>
              Cancelar
            </Button>
          </FormActions>
        </ActionForm>
      )}
    </Dialog>
  );
}

function ToggleActiveDialog({ user }: UserActionsProps) {
  return user.active ? (
    <ConfirmDialog
      trigger={<Button variant="danger-ghost" icon={<UserX />} aria-label={`Desativar ${user.name}`}>Desativar</Button>}
      title={`Desativar ${user.name}?`}
      description="A pessoa não consegue mais entrar e é desconectada agora. Nada é apagado: dá para reativar a conta quando quiser. Depois, confira em Notificações se o e-mail dela ainda recebe os avisos de novo lead."
      confirmLabel="Desativar conta"
      action={setUserActiveAction}
      hidden={{ id: user.id, active: "false" }}
    />
  ) : (
    <ConfirmDialog
      trigger={<Button variant="secondary" icon={<UserCheck />} aria-label={`Reativar ${user.name}`}>Reativar</Button>}
      title={`Reativar ${user.name}?`}
      description="A pessoa volta a poder entrar com a senha que já tinha. Se ela esqueceu, gere uma nova senha depois."
      confirmLabel="Reativar conta"
      tone="primary"
      action={setUserActiveAction}
      hidden={{ id: user.id, active: "true" }}
    />
  );
}

export function UserActions({ user, isSelf }: UserActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <EditDialog user={user} isSelf={isSelf} />
      {isSelf ? null : (
        <>
          <ResetPasswordDialog user={user} isSelf={isSelf} />
          <ToggleActiveDialog user={user} isSelf={isSelf} />
        </>
      )}
    </div>
  );
}
