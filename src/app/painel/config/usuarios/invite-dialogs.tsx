"use client";

import { Ban, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, RadioCards, Select, type SelectOption } from "@/components/ui/input";
import { TEAM_FUNCTIONS, USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS, type UserRole } from "@/lib/domain";
import { createInviteAction, resendInviteAction, revokeInviteAction, type InviteLinkData } from "@/server/access/invite-actions";
import { InviteLinkPanel } from "./invite-link";

/** Ordem em que os perfis aparecem no convite: do mais comum para o mais raro. */
const INVITE_ROLES: readonly UserRole[] = ["funcionario", "freelancer", "cliente", "gestor", "socio", "admin", "tecnico"];
const roleOptions = INVITE_ROLES.map((role) => ({ value: role, label: USER_ROLE_LABELS[role], description: USER_ROLE_DESCRIPTIONS[role] }));

/**
 * "Convidar pessoa": e-mail, nome e perfil; para Cliente, a ficha a que a conta fica vinculada; para Funcionário
 * e Freelancer, um projeto (opcional). Depois de criar, o link aparece UMA vez (sem e-mail configurado, é o único
 * jeito de entregá-lo).
 */
export function InviteDialog({ clients, projects }: { clients: SelectOption[]; projects: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>("funcionario");
  const [invite, setInvite] = useState<InviteLinkData | null>(null);
  const worksByProject = role === "funcionario" || role === "freelancer";

  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setInvite(null); // ao fechar, o link some da tela
      setRole("funcionario");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={change}
      size="lg"
      trigger={<Button icon={<UserPlus />}>Convidar pessoa</Button>}
      title={invite ? "Convite criado" : "Convidar pessoa"}
      description={invite ? undefined : "A pessoa recebe um link, cria a própria senha e já entra com o perfil escolhido. O link vale por 7 dias."}
    >
      {invite ? (
        <InviteLinkPanel invite={invite} onDone={() => change(false)} />
      ) : (
        <ActionForm action={createInviteAction} onSuccess={(state) => setInvite(state.data ?? null)} success="none">
          <Field name="email" label="E-mail" required hint="É o login da pessoa. O convite só vale para este e-mail.">
            <Input type="email" maxLength={160} autoComplete="off" inputMode="email" />
          </Field>
          <Field name="name" label="Nome" optional hint="A pessoa pode corrigir ao criar a senha.">
            <Input maxLength={120} autoComplete="off" />
          </Field>
          <Field name="role" label="Perfil" group required>
            <RadioCards name="role" cols={1} value={role} onValueChange={(value) => setRole(value as UserRole)} options={roleOptions} />
          </Field>
          {role === "cliente" ? (
            <Field name="clientId" label="Ficha do cliente" required hint="A conta só enxerga os projetos deste cliente.">
              <Select options={clients} placeholder={clients.length > 0 ? "Escolha o cliente" : "Cadastre o cliente primeiro"} defaultValue="" />
            </Field>
          ) : null}
          {worksByProject ? (
            <>
              <Field name="projectId" label="Projeto" optional hint="A pessoa já entra na equipe deste projeto, só podendo ver. O resto você ajusta na página do projeto.">
                <Select options={projects} placeholder="Nenhum por enquanto" defaultValue="" />
              </Field>
              <Field name="projectRole" label="Papel no projeto" optional hint="Ex.: Fotógrafo, Editor. Só vale se você escolher um projeto.">
                <Input maxLength={60} list="convite-funcoes" autoComplete="off" />
              </Field>
              <datalist id="convite-funcoes">
                {TEAM_FUNCTIONS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </>
          ) : null}
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

/** "Convidar de novo": gera um link novo para o mesmo convite (o anterior deixa de funcionar) e mostra uma vez. */
export function ResendInviteDialog({ inviteId, email }: { inviteId: number; email: string }) {
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
        <Button variant="secondary" icon={<Send />} aria-label={`Convidar de novo ${email}`}>
          Convidar de novo
        </Button>
      }
      title={invite ? "Novo link criado" : "Convidar de novo?"}
      description={invite ? undefined : `Vamos gerar um link novo para ${email}, com os mesmos dados do convite. O link anterior deixa de funcionar.`}
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

export function RevokeInviteDialog({ inviteId, email }: { inviteId: number; email: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger-ghost" icon={<Ban />} aria-label={`Revogar o convite de ${email}`}>
          Revogar
        </Button>
      }
      title="Revogar este convite?"
      description={`O link enviado para ${email} deixa de funcionar na hora. Dá para convidar de novo depois.`}
      confirmLabel="Revogar convite"
      action={revokeInviteAction}
      hidden={{ id: inviteId }}
    />
  );
}
