import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { paramOneOf, type PageSearchParams } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { BRAND_ASSET_CATEGORIES } from "@/lib/domain";
import { createBrandAssetAction } from "../actions";
import { AssetForm } from "../asset-form";

export const metadata: Metadata = { title: "Novo item da marca" };
export const instant = false;

export default async function NewBrandAssetPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const category = paramOneOf(BRAND_ASSET_CATEGORIES, (await searchParams).categoria);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Novo item da marca" description="Guarde um link (Drive, Canva) e/ou um arquivo da marca." back={{ href: "/painel/marca", label: "Marca" }} />
      <AssetForm action={createBrandAssetAction} file={null} defaultCategory={category} submitLabel="Adicionar item" />
    </div>
  );
}
