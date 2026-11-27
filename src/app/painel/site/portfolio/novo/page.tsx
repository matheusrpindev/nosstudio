import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { listRelatedOptions } from "@/server/site/admin/portfolio";
import { savePortfolioAction } from "../actions";
import { EMPTY_PORTFOLIO_MEDIA, PortfolioForm } from "../form";
import { RealWorkNotice } from "../notice";

export const metadata: Metadata = { title: "Novo projeto" };
export const instant = false;

export default async function NewPortfolioPage() {
  await requirePermission("site", "editar");
  const related = await listRelatedOptions(null);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo projeto" back={{ href: "/painel/site/portfolio", label: "Portfólio do site" }} />
      <RealWorkNotice />
      <PortfolioForm action={savePortfolioAction} project={null} media={EMPTY_PORTFOLIO_MEDIA} related={related} />
    </div>
  );
}
