"use client";

import { Pencil, UserMinus, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, Select, type SelectOption } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TEAM_FUNCTIONS } from "@/lib/domain";
import { addProjectMemberAction, removeProjectMemberAction, updateProjectMemberAction } from "../actions";

type MemberValues = { role: string; canView: boolean; canEdit: boolean; canDownload: boolean; canUpload: boolean };

/** Papel no projeto + o que a pessoa pode nele. Mesmos campos ao incluir e ao editar. */
function MemberFields({ values }: { values: MemberValues }) {
  const listId = useId();
  return (
    <>
      <Field name="role" label="Papel neste projeto" optional hint="Ex.: Fotógrafo, Editor. Escolha uma sugestão ou escreva outro.">
        <Input maxLength={60} defaultValue={values.role} list={listId} autoComplete="off" />
      </Field>
      <datalist id={listId}>
        {TEAM_FUNCTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <fieldset>
        <legend className="label">O que a pessoa pode neste projeto</legend>
        <div className="divide-borda border-borda rounded-campo divide-y border px-3">
          <Switch name="canView" label="Ver o projeto" hint="Desligado, o acesso fica pausado sem tirar a pessoa da equipe." defaultChecked={values.canView} />
          <Switch name="canEdit" label="Editar" hint="Mudar a etapa, marcar o checklist e criar ou concluir tarefas." defaultChecked={values.canEdit} />
          <Switch name="canDownload" label="Baixar arquivos" hint="Abrir os links dos arquivos do projeto (Drive, galeria, arquivos finais)." defaultChecked={values.canDownload} />
          <Switch name="canUpload" label="Enviar arquivos" hint="Entregar arquivos para o projeto (vale quando a Área da Equipe abrir)." defaultChecked={values.canUpload} />
        </div>
      </fieldset>
    </>
  );
}

export function AddMemberDialog({ projectId, candidates }: { projectId: number; candidates: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="sm" icon={<UserPlus />}>
          Adicionar
        </Button>
      }
      title="Adicionar à equipe do projeto"
      description="A pessoa passa a enxergar este projeto. Ela precisa já ter uma conta de funcionário, freelancer ou gestor."
    >
      {candidates.length === 0 ? (
        <p className="text-texto-suave text-sm leading-relaxed">
          Não há contas disponíveis para incluir. Convide a pessoa em <strong className="text-texto">Configurações › Usuários › Convidar pessoa</strong> (dá para já escolher este projeto no convite).
        </p>
      ) : (
        <ActionForm action={addProjectMemberAction} hidden={{ projectId }} onSuccess={() => setOpen(false)}>
          <Field name="userId" label="Pessoa" required>
            <Select options={candidates} placeholder="Escolha a pessoa" defaultValue="" />
          </Field>
          <MemberFields values={{ role: "", canView: true, canEdit: false, canDownload: false, canUpload: false }} />
          <FormActions>
            <SubmitButton pendingLabel="Adicionando…">Adicionar à equipe</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </FormActions>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditMemberDialog({ projectId, member }: { projectId: number; member: MemberValues & { userId: number; name: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <IconButton aria-label={`Editar o que ${member.name} pode neste projeto`}>
          <Pencil />
        </IconButton>
      }
      title={member.name}
      description="Papel e permissões desta pessoa neste projeto. Vale a partir do próximo clique dela."
    >
      <ActionForm action={updateProjectMemberAction} hidden={{ projectId, userId: member.userId }} onSuccess={() => setOpen(false)}>
        <MemberFields values={member} />
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

export function RemoveMemberDialog({ projectId, userId, name }: { projectId: number; userId: number; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <IconButton aria-label={`Tirar ${name} do projeto`} variant="danger-ghost">
          <UserMinus />
        </IconButton>
      }
      title={`Tirar ${name} do projeto?`}
      description="A pessoa deixa de enxergar este projeto na hora. A conta dela continua existindo e dá para incluí-la de novo."
      confirmLabel="Tirar do projeto"
      action={removeProjectMemberAction}
      hidden={{ projectId, userId }}
    />
  );
}
