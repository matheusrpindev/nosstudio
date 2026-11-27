import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { paramOneOf, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { PACKAGE_KINDS } from "@/lib/domain";
import { listBasePlanOptions } from "@/server/site/admin/packages";
import { savePackageAction } from "../actions";
import { PackageForm } from "../form";
import { PricingNotice } from "../notice";

export const metadata: Metadata = { title: "Novo plano" };
export const instant = false;

export default async function NewPackagePage({ searchParams }: { searchParams: PageSearchParams }) {
  await requirePermission("site", "editar");
  const kind = paramOneOf(PACKAGE_KINDS, (await searchParams).tipo);
  const basePlans = await listBasePlanOptions();
  return (
    <div className="max-w-3xl">
      <PageHeader title={kind === "avulso" ? "Novo serviço avulso" : "Novo plano"} back={{ href: "/painel/site/pacotes", label: "Planos do site" }} />
      <PricingNotice />
      <Card>
        <PackageForm action={savePackageAction} pkg={null} defaultKind={kind} basePlans={basePlans} />
      </Card>
    </div>
  );
}
