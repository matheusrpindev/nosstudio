import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { CONTRACT_KIND_LABELS, CONTRACT_KINDS } from "@/lib/domain";
import { truncate } from "@/lib/format";
import { listTemplates } from "@/server/contracts/admin";
import { deleteTemplateAction } from "../actions";
import { LEGAL_REVIEW_NOTICE } from "../ui";

export const metadata: Metadata = { title: "Modelos de contrato" };
export const instant = false;

/** Tira a marcação markdown para mostrar um resumo em texto simples. */
const plain = (body: string) => body.replace(/[#*_>`[\]]/g, "").replace(/\s+/g, " ").trim();

export default async function ContractTemplatesPage() {
  await requireUser();
  const templates = await listTemplates();
  const groups = CONTRACT_KINDS.map((kind) => ({ kind, items: templates.filter((t) => t.kind === kind) })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="Modelos de contrato"
        description="Textos prontos por tipo de contrato. Ao criar um contrato, você escolhe um modelo: o texto é copiado e os campos automáticos (como {{cliente}} e {{valor_total}}) são preenchidos com os dados do cliente e da proposta."
        back={{ href: "/painel/contratos", label: "Contratos" }}
        actions={
          <ButtonLink href="/painel/contratos/modelos/novo" icon={<Plus />}>
            Novo modelo
          </ButtonLink>
        }
      />
      <Alert tone="alerta" className="mb-6">
        {LEGAL_REVIEW_NOTICE}
      </Alert>

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="Nenhum modelo ainda"
          description="Crie um modelo para cada tipo de contrato que vocês usam: mensal, evento, casamento, diária ou acordo entre sócios."
          action={<ButtonLink href="/painel/contratos/modelos/novo" icon={<Plus />}>Novo modelo</ButtonLink>}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.kind} aria-labelledby={`tipo-${group.kind}`}>
              <h2 id={`tipo-${group.kind}`} className="text-texto mb-3 text-base font-bold">
                {CONTRACT_KIND_LABELS[group.kind]}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {group.items.map((template) => (
                  <Card as="li" key={template.id} className="flex flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-texto min-w-0 text-base leading-snug font-bold break-words">{template.title}</h3>
                      {template.versionLabel ? <Badge tone="roxo">{template.versionLabel}</Badge> : null}
                    </div>
                    <p className="text-texto-suave mt-2 flex-1 text-sm leading-relaxed break-words">{truncate(plain(template.body), 160) || "Sem texto."}</p>
                    <p className="text-texto-suave mt-3 text-[0.8125rem]">
                      Atualizado em <DateText value={template.updatedAt} format="datetime" />
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ButtonLink href={`/painel/contratos/novo?modelo=${template.id}`} variant="secondary" icon={<FileText />}>
                        Usar em um contrato
                      </ButtonLink>
                      <ButtonLink href={`/painel/contratos/modelos/${template.id}`} variant="ghost" icon={<Pencil />}>
                        Editar
                      </ButtonLink>
                      <ConfirmDialog
                        trigger={
                          <Button variant="danger-ghost" icon={<Trash2 />}>
                            Excluir
                          </Button>
                        }
                        title="Excluir este modelo?"
                        description={
                          <>
                            O modelo <strong className="text-texto">{template.title}</strong> será apagado. Contratos já criados a partir dele não mudam.
                          </>
                        }
                        confirmLabel="Excluir modelo"
                        action={deleteTemplateAction}
                        hidden={{ id: template.id }}
                      />
                    </div>
                  </Card>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
