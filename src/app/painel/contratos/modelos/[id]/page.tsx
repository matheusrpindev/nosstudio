import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getTemplate } from "@/server/contracts/admin";
import { updateTemplateAction } from "../../actions";
import { LEGAL_REVIEW_NOTICE } from "../../ui";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Editar modelo de contrato" };
export const instant = false;

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("contratos", "ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const template = await getTemplate(id);
  if (!template) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Editar modelo" description={template.title} back={{ href: "/painel/contratos/modelos", label: "Modelos" }} />
      <Alert tone="alerta" className="mb-4">
        {LEGAL_REVIEW_NOTICE}
      </Alert>
      <TemplateForm action={updateTemplateAction} template={template} submitLabel="Salvar modelo" />
    </div>
  );
}
