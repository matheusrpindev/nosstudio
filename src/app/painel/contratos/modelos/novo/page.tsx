import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { createTemplateAction } from "../../actions";
import { LEGAL_REVIEW_NOTICE } from "../../ui";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Novo modelo de contrato" };
export const instant = false;

export default async function NewTemplatePage() {
  await requireUser();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo modelo" description="Um texto reutilizável para um tipo de contrato." back={{ href: "/painel/contratos/modelos", label: "Modelos" }} />
      <Alert tone="alerta" className="mb-4">
        {LEGAL_REVIEW_NOTICE}
      </Alert>
      <TemplateForm action={createTemplateAction} submitLabel="Criar modelo" />
    </div>
  );
}
