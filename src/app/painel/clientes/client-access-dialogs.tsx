"use client";

import { Link2, Send, UserMinus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, Select, type SelectOption } from "@/components/ui/input";
import { createInviteAction, resendInviteAction, revokeInviteAction, type InviteLinkData } from "@/server/access/invite-actions";
import { linkClientUserAction, unlinkClientUserAction } from "../config/usuarios/actions";
import { InviteLinkPanel } from "../config/usuarios/invite-link";

/** Convida uma pessoa do cliente: a conta nasce com o perfil Cliente, já vinculada a esta ficha. */
export function InviteClientAccessDialog({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<InviteLinkData | null>(null);
  function change(next: boolean) {
    setOpen(next);
    if (!next) setInvite(null); // ao fechar, o link some da tela
  }
  return (
    <Dialog
      open={open}
      onOpenChange={change}
      trigger={
        <Button variant="ghost" size="sm" icon={<UserPlus />}>
          Convidar
        </Button>
      }
      title={invite ? "Convite criado" : "Convidar acesso do cliente"}
      description={invite ? undefined : `A pessoa recebe um link para criar a própria senha. A conta só enxerga os projetos de ${clientName}.`}
    >
      {invite ? (
        <InviteLinkPanel invite={invite} onDone={() => change(false)} />
      ) : (
        <ActionForm action={createInviteAction} hidden={{ role: "cliente", clientId }} onSuccess={(state) => setInvite(state.data ?? null)} success="none">
          <Field name="email" label="E-mail da pessoa" required hint="É o login dela. O convite só vale para este e-mail.">
            <Input type="email" maxLength={160} autoComplete="off" inputMode="email" />
          </Field>
          <Field name="name" label="Nome" optional hint="A pessoa pode corrigir ao criar a senha.">
            <Input maxLength={120} autoComplete="off" />
          </Field>
          <FormActions>
            <SubmitButton pendingLabel="Criando convite…">Criar convite</SubmitButton>
            <Button variant="ghost" onClick={() => change(false)}>
              Cancelar
            </Button>
          </FormActions>
        </ActionForm>
      )}
    </Dialog>
  );
}

/** "Convidar de novo": gera um link novo (o anterior deixa de funcionar) e mostra uma vez. */
export function ResendClientInviteButton({ inviteId, email }: { inviteId: number; email: string }) {
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<InviteLinkData | null>(null);
  function change(next: boolean) {
    setOpen(next);
    if (!next) setInvite(null);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={change}
      trigger={
        <IconButton aria-label={`Convidar de novo ${email}`}>
          <Send />
        </IconButton>
      }
      title={invite ? "Novo link criado" : "Convidar de novo?"}
      description={invite ? undefined : `Vamos gerar um link novo para ${email}. O link anterior deixa de funcionar.`}
    >
      {invite ? (
        <InviteLinkPanel invite={invite} onDone={() => change(false)} />
      ) : (
        <ActionForm action={resendInviteAction} hidden={{ id: inviteId }} onSuccess={(state) => setInvite(state.data ?? null)} success="none">
          <FormActions>
            <SubmitButton pendingLabel="Gerando…">Gerar novo link</SubmitButton>
            <Button variant="ghost" onClick={() => change(false)}>
              Cancelar
            </Button>
          </FormActions>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function RevokeClientInviteDialog({ inviteId, email }: { inviteId: number; email: string }) {
  return (
    <ConfirmDialog
      trigger={
        <IconButton aria-label={`Revogar o convite de ${email}`} variant="danger-ghost">
          <X />
        </IconButton>
      }
      title="Revogar este convite?"
      description={`O link enviado para ${email} deixa de funcionar na hora. Dá para convidar de novo depois.`}
      confirmLabel="Revogar convite"
      action={revokeInviteAction}
      hidden={{ id: inviteId }}
    />
  );
}

export function UnlinkClientUserDialog({ clientId, userId, name }: { clientId: number; userId: number; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger-ghost" size="sm" icon={<UserMinus />} aria-label={`Desvincular ${name}`}>
          Desvincular
        </Button>
      }
      title={`Desvincular ${name}?`}
      description="A conta deixa de ver os projetos deste cliente na hora. Ela continua existindo: para impedir que a pessoa entre, desative a conta em Configurações › Usuários."
      confirmLabel="Desvincular"
      action={unlinkClientUserAction}
      hidden={{ clientId, userId }}
    />
  );
}

/** Vincula a esta ficha uma conta de perfil Cliente que já existe (ex.: a mesma pessoa responde por duas empresas). */
export function LinkClientUserDialog({ clientId, candidates }: { clientId: number; candidates: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="secondary" size="sm" icon={<Link2 />}>
          Vincular conta que já existe
        </Button>
      }
      title="Vincular conta de cliente"
      description="Para quando a pessoa já tem conta (por exemplo, responde por outra empresa). Ela passa a ver também os projetos deste cliente."
    >
      <ActionForm action={linkClientUserAction} hidden={{ clientId }} onSuccess={() => setOpen(false)}>
        <Field name="userId" label="Conta" required>
          <Select options={candidates} placeholder="Escolha a conta" defaultValue="" />
        </Field>
        <FormActions>
          <SubmitButton pendingLabel="Vinculando…">Vincular</SubmitButton>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </FormActions>
      </ActionForm>
    </Dialog>
  );
}
