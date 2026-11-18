import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { saveServiceAction } from "../actions";
import { ServiceForm } from "../form";

export const metadata: Metadata = { title: "Novo serviço" };
export const instant = false;

export default async function NewServicePage() {
  await requireUser();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo serviço" back={{ href: "/painel/site/servicos", label: "Serviços do site" }} />
      <Card>
        <ServiceForm action={saveServiceAction} service={null} cover={null} gallery={[]} />
      </Card>
    </div>
  );
}
