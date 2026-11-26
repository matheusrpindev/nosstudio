import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { savePortfolioAction } from "../actions";
import { PortfolioForm } from "../form";
import { RealWorkNotice } from "../notice";

export const metadata: Metadata = { title: "Novo projeto" };
export const instant = false;

export default async function NewPortfolioPage() {
  await requirePermission("site", "editar");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo projeto" back={{ href: "/painel/site/portfolio", label: "Portfólio do site" }} />
      <RealWorkNotice />
      <Card>
        <PortfolioForm action={savePortfolioAction} project={null} cover={null} gallery={[]} />
      </Card>
    </div>
  );
}
