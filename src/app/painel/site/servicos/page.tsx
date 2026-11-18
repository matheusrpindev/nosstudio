import { ExternalLink, Layers, Plus } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { SERVICE_INTEREST_LABELS } from "@/lib/domain";
import type { Service } from "@/db/schema";
import { listServices } from "@/server/site/admin/services";
import { MoveButtons, RowSwitch } from "../_colecoes/row-controls";
import { moveServiceAction, toggleServiceAction } from "./actions";

export const metadata: Metadata = { title: "Serviços do site" };
export const instant = false;

export default async function ServicesPage() {
  await requireUser();
  const rows = await listServices();

  const columns: DataListColumn<Service>[] = [
    {
      key: "servico",
      header: "Serviço",
      primary: true,
      cell: (service) => (
        <>
          <span className="block break-words">{service.title}</span>
          {service.summary ? <span className="text-cinza line-clamp-2 block text-[0.8125rem] font-normal">{service.summary}</span> : null}
        </>
      ),
    },
    { key: "interesse", header: "Interesse no formulário", hideOnMobile: true, cell: (service) => SERVICE_INTEREST_LABELS[service.interest] },
    { key: "pagina", header: "Página própria", hideOnMobile: true, cell: (service) => (service.pagePath ? <Badge tone="roxo">{service.pagePath}</Badge> : <span className="text-cinza">—</span>) },
    { key: "visivel", header: "No site", interactive: true, cell: (service) => <RowSwitch id={service.id} checked={service.visible} label={`Mostrar “${service.title}” no site`} action={toggleServiceAction} /> },
    {
      key: "ordem",
      header: "Ordem",
      interactive: true,
      cell: (service) => {
        const index = rows.indexOf(service);
        return <MoveButtons id={service.id} name={service.title} isFirst={index === 0} isLast={index === rows.length - 1} action={moveServiceAction} />;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Serviços do site"
        description="O que a NÓS Studio oferece, na ordem em que aparece em Serviços e na página inicial. Serviços ocultos ficam guardados aqui."
        actions={
          <>
            <ButtonLink href="/servicos" external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            <ButtonLink href="/painel/site/servicos/novo" icon={<Plus />}>
              Novo serviço
            </ButtonLink>
          </>
        }
      />
      <DataList
        caption="Serviços do site"
        columns={columns}
        rows={rows}
        rowKey={(service) => service.id}
        href={(service) => `/painel/site/servicos/${service.id}`}
        empty={
          <EmptyState
            variant="plain"
            icon={<Layers />}
            title="Nenhum serviço cadastrado"
            description="Cadastre os serviços que a NÓS oferece para eles aparecerem no site."
            action={
              <ButtonLink href="/painel/site/servicos/novo" icon={<Plus />}>
                Novo serviço
              </ButtonLink>
            }
          />
        }
      />
    </>
  );
}
