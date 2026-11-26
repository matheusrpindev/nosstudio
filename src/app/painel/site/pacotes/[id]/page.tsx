import { ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { getPackage } from "@/server/site/admin/packages";
import { deletePackageAction, savePackageAction } from "../actions";
import { PackageForm } from "../form";
import { PricingNotice } from "../notice";

export const metadata: Metadata = { title: "Editar pacote" };
export const instant = false;

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("site", "editar");
  const id = paramId((await params).id);
  const pkg = id ? await getPackage(id) : null;
  if (!pkg) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={pkg.name}
        description="As mudanças aparecem no site assim que você salvar."
        back={{ href: "/painel/site/pacotes", label: "Pacotes do site" }}
        actions={
          <>
            <ButtonLink href="/pacotes" external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Trash2 />}>
                  Excluir pacote
                </Button>
              }
              title="Excluir este pacote?"
              description="Ele sai do site e não dá para recuperar. Para só esconder por um tempo, desligue “Mostrar no site” em vez de excluir."
              confirmLabel="Excluir pacote"
              action={deletePackageAction}
              hidden={{ id: pkg.id }}
            />
          </>
        }
      />
      <PricingNotice />
      <Card>
        <PackageForm action={savePackageAction} pkg={pkg} />
      </Card>
    </div>
  );
}
