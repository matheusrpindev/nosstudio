import { ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { getMediaValue, getMediaValues } from "@/server/media";
import { getService } from "@/server/site/admin/services";
import { deleteServiceAction, saveServiceAction } from "../actions";
import { ServiceForm } from "../form";

export const metadata: Metadata = { title: "Editar serviço" };
export const instant = false;

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("site", "editar");
  const id = paramId((await params).id);
  const service = id ? await getService(id) : null;
  if (!service) notFound();
  const [cover, gallery] = await Promise.all([getMediaValue(service.coverMediaId), getMediaValues(service.gallery)]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={service.title}
        description="Edite o serviço. As mudanças aparecem no site assim que você salvar."
        back={{ href: "/painel/site/servicos", label: "Serviços do site" }}
        actions={
          <>
            <ButtonLink href={service.pagePath ?? "/servicos"} external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Trash2 />}>
                  Excluir serviço
                </Button>
              }
              title="Excluir este serviço?"
              description="Ele sai do site e não dá para recuperar. Para só esconder por um tempo, desligue “Mostrar no site” em vez de excluir."
              confirmLabel="Excluir serviço"
              action={deleteServiceAction}
              hidden={{ id: service.id }}
            />
          </>
        }
      />
      <Card>
        <ServiceForm action={saveServiceAction} service={service} cover={cover} gallery={gallery} />
      </Card>
    </div>
  );
}
