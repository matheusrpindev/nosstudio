"use client";

import { ActionForm, FormActions, SubmitButton } from "@/components/ui/form";
import { StringListField } from "@/components/ui/list-fields";
import { Switch } from "@/components/ui/switch";
import { saveNotificationsAction } from "./actions";

export function NotificationsForm({ defaults }: { defaults: { notifyOnLead: boolean; leadEmails: string[] } }) {
  return (
    <ActionForm action={saveNotificationsAction}>
      <Switch name="notifyOnLead" label="Avisar por e-mail a cada novo lead" hint="Vale para pedidos que chegam pelo formulário do site." defaultChecked={defaults.notifyOnLead} />
      <StringListField
        name="leadEmails"
        label="Quem recebe o aviso"
        hint="Deixe a lista vazia para avisar todos os usuários ativos do painel."
        defaultValue={defaults.leadEmails}
        placeholder="nome@dominio.com.br"
        addLabel="Adicionar e-mail"
        emptyLabel="Nenhum e-mail na lista: o aviso vai para todos os usuários ativos."
        max={10}
        maxLength={160}
      />
      <FormActions>
        <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
