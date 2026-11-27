import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { MarkdownField } from "@/components/ui/markdown-field";
import { Switch } from "@/components/ui/switch";
import type { Faq } from "@/db/schema";

/** Formulário de pergunta frequente. `faq` nulo = nova. */
export function FaqForm({ action, faq }: { action: FormAction; faq: Faq | null }) {
  return (
    <ActionForm action={action} hidden={{ id: faq?.id }}>
      <Field name="question" label="Pergunta" required>
        <Textarea rows={2} maxLength={240} defaultValue={faq?.question} />
      </Field>
      <MarkdownField name="answer" label="Resposta" optional rows={8} maxLength={6000} defaultValue={faq?.answer} hint="Sem resposta preenchida, a pergunta não pode ser publicada." />
      <div className="space-y-1">
        <Switch name="published" label="Publicada no site" hint="Desligada, fica como rascunho e não aparece para os visitantes. Só publique depois que os sócios revisarem a resposta." defaultChecked={faq?.published ?? false} />
        <Switch name="showOnHome" label="Mostrar na página inicial" hint="Aparece no resumo de perguntas da página inicial (só se estiver publicada)." defaultChecked={faq?.showOnHome ?? false} />
        <Switch name="showOnWeddings" label="Mostrar em Eventos e Casamentos" hint="Aparece nas perguntas da página de Eventos e Casamentos (só se estiver publicada). Sem nenhuma das duas marcas, a pergunta publicada não aparece em lugar nenhum." defaultChecked={faq?.showOnWeddings ?? false} />
      </div>
      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{faq ? "Salvar pergunta" : "Criar pergunta"}</SubmitButton>
        <ButtonLink href="/painel/site/faq" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
