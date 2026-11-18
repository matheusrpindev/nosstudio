import { Copy, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Money } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { PROPOSAL_MODALITY_LABELS } from "@/lib/domain";
import { listTemplates } from "@/server/proposals/admin";
import { createTemplateAction, deleteProposalAction, duplicateProposalAction } from "../actions";

export const metadata: Metadata = { title: "Modelos de proposta" };
export const instant = false;

function NewTemplateDialog({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  return (
    <Dialog
      trigger={
        <Button icon={<Plus />} variant={variant}>
          Novo modelo
        </Button>
      }
      title="Novo modelo"
      description="Um modelo guarda itens, parcelas, textos e custos de referência para você reaproveitar. Depois de criar, monte o conteúdo no editor."
    >
      <ActionForm action={createTemplateAction}>
        <Field name="templateName" label="Nome do modelo" hint="Só aparece no painel. Ex.: Evento corporativo — meia diária" required>
          <Input maxLength={120} autoComplete="off" />
        </Field>
        <Field name="modality" label="Modalidade" required>
          <Select options={PROPOSAL_MODALITY_LABELS} defaultValue="personalizada" />
        </Field>
        <FormActions>
          <SubmitButton pendingLabel="Criando…">Criar e abrir o editor</SubmitButton>
        </FormActions>
      </ActionForm>
    </Dialog>
  );
}

export default async function TemplatesPage() {
  await requireUser();
  const templates = await listTemplates();

  return (
    <>
      <PageHeader
        title="Modelos de proposta"
        description="Pontos de partida prontos: escolha um modelo ao criar um orçamento e ajuste só o que muda para aquele cliente."
        back={{ href: "/painel/orcamentos", label: "Orçamentos" }}
        actions={<NewTemplateDialog />}
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate />}
          title="Nenhum modelo ainda"
          description="Crie um modelo em branco aqui, ou abra uma proposta pronta e use “Salvar como modelo” na etapa PDF e controle."
          action={<NewTemplateDialog />}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card as="li" key={template.id} className="flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-grafite min-w-0 text-base leading-snug font-bold break-words">{template.templateName}</h2>
                <Badge tone="roxo">{PROPOSAL_MODALITY_LABELS[template.modality]}</Badge>
              </div>
              <p className="text-cinza mt-1 text-sm break-words">{template.title}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-cinza text-[0.8125rem]">Itens</dt>
                  <dd className="text-grafite font-semibold tabular-nums">{template.itemCount}</dd>
                </div>
                <div>
                  <dt className="text-cinza text-[0.8125rem]">Total de referência</dt>
                  <dd className="text-grafite font-semibold">{template.totalCents > 0 ? <Money cents={template.totalCents} /> : "A definir"}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap items-center gap-2 pt-1 max-sm:[&>a]:flex-1">
                <ButtonLink href={`/painel/orcamentos/novo?modelo=${template.id}`} icon={<Plus />}>
                  Usar modelo
                </ButtonLink>
                <ButtonLink href={`/painel/orcamentos/${template.id}`} variant="secondary" icon={<Pencil />}>
                  Editar
                </ButtonLink>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" icon={<Copy />}>
                      Duplicar
                    </Button>
                  }
                  title="Duplicar este modelo?"
                  description={
                    <>
                      Vamos criar uma cópia de <strong className="text-grafite">{template.templateName}</strong> e abrir o editor.
                    </>
                  }
                  confirmLabel="Duplicar"
                  tone="primary"
                  action={duplicateProposalAction}
                  hidden={{ id: template.id }}
                />
                <ConfirmDialog
                  trigger={
                    <Button variant="danger-ghost" icon={<Trash2 />}>
                      Excluir
                    </Button>
                  }
                  title="Excluir este modelo?"
                  description={
                    <>
                      O modelo <strong className="text-grafite">{template.templateName}</strong> será apagado. As propostas já criadas a partir dele não mudam.
                    </>
                  }
                  confirmLabel="Excluir modelo"
                  action={deleteProposalAction}
                  hidden={{ id: template.id }}
                />
              </div>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
