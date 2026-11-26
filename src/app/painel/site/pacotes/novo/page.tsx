import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { paramOneOf, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { PACKAGE_KINDS } from "@/lib/domain";
import { savePackageAction } from "../actions";
import { PackageForm } from "../form";
import { PricingNotice } from "../notice";

export const metadata: Metadata = { title: "Novo pacote" };
export const instant = false;

export default async function NewPackagePage({ searchParams }: { searchParams: PageSearchParams }) {
  await requirePermission("site", "editar");
  const kind = paramOneOf(PACKAGE_KINDS, (await searchParams).tipo);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo pacote" back={{ href: "/painel/site/pacotes", label: "Pacotes do site" }} />
      <PricingNotice />
      <Card>
        <PackageForm action={savePackageAction} pkg={null} defaultKind={kind} />
      </Card>
    </div>
  );
}
