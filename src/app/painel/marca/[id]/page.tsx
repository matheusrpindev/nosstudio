import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getBrandAsset } from "@/server/brand/admin";
import { getMediaValue } from "@/server/media";
import { updateBrandAssetAction } from "../actions";
import { AssetForm } from "../asset-form";

export const metadata: Metadata = { title: "Editar item da marca" };
export const instant = false;

export default async function EditBrandAssetPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("marca", "ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const asset = await getBrandAsset(id);
  if (!asset) notFound();
  const file = await getMediaValue(asset.mediaId);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Editar item" description={asset.title} back={{ href: "/painel/marca", label: "Marca" }} />
      <AssetForm action={updateBrandAssetAction} asset={asset} file={file} submitLabel="Salvar alterações" />
    </div>
  );
}
