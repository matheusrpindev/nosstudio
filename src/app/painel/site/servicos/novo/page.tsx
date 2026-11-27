import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { listRelatedProjectOptions } from "@/server/site/admin/services";
import { saveServiceAction } from "../actions";
import { ServiceForm } from "../form";

export const metadata: Metadata = { title: "Novo serviço" };
export const instant = false;

export default async function NewServicePage() {
  await requirePermission("site", "editar");
  const projects = await listRelatedProjectOptions();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Novo serviço"
        description="Ao criar, o serviço ganha uma página própria no site (/servicos/nome-do-servico) e entra no menu de serviços e na página inicial — sem precisar de programador."
        back={{ href: "/painel/site/servicos", label: "Serviços do site" }}
      />
      <Card>
        <ServiceForm action={saveServiceAction} service={null} cover={null} gallery={[]} projects={projects} />
      </Card>
    </div>
  );
}
