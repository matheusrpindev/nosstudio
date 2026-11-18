import { ExternalLink, Package as PackageIcon, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { PRICE_MODE_LABELS, type PackageKind } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import type { Package } from "@/db/schema";
import { listPackages } from "@/server/site/admin/packages";
import { MoveButtons, RowSwitch } from "../_colecoes/row-controls";
import { movePackageAction, togglePackageAction } from "./actions";
import { PricingNotice } from "./notice";

export const metadata: Metadata = { title: "Pacotes do site" };
export const instant = false;

function priceText(pkg: Package): string {
  if (pkg.priceMode === "sob_consulta" || !pkg.priceCents) return PRICE_MODE_LABELS.sob_consulta;
  return `${pkg.priceMode === "a_partir" ? "A partir de " : ""}${formatBRL(pkg.priceCents)}${pkg.priceSuffix ? ` ${pkg.priceSuffix}` : ""}`;
}

export default async function PackagesPage() {
  await requireUser();
  const all = await listPackages();

  function columnsFor(group: Package[]): DataListColumn<Package>[] {
    return [
      {
        key: "pacote",
        header: "Pacote",
        primary: true,
        cell: (pkg) => (
          <>
            <span className="flex flex-wrap items-center gap-2 break-words">
              {pkg.name}
              {pkg.recommended ? <Badge tone="lima">Recomendado</Badge> : null}
            </span>
            {pkg.tagline ? <span className="text-cinza line-clamp-2 block text-[0.8125rem] font-normal">{pkg.tagline}</span> : null}
          </>
        ),
      },
      { key: "preco", header: "Preço no site", cell: (pkg) => priceText(pkg) },
      { key: "entregas", header: "Entregas com quantidade", hideOnMobile: true, cell: (pkg) => (pkg.deliverables.length > 0 ? `${pkg.deliverables.length}` : <span className="text-cinza">Não exibe</span>) },
      { key: "visivel", header: "No site", interactive: true, cell: (pkg) => <RowSwitch id={pkg.id} checked={pkg.visible} label={`Mostrar “${pkg.name}” no site`} action={togglePackageAction} /> },
      {
        key: "ordem",
        header: "Ordem",
        interactive: true,
        cell: (pkg) => {
          const index = group.indexOf(pkg);
          return <MoveButtons id={pkg.id} name={pkg.name} isFirst={index === 0} isLast={index === group.length - 1} action={movePackageAction} />;
        },
      },
    ];
  }

  const groups: { kind: PackageKind; title: string }[] = [
    { kind: "plano", title: "Planos mensais" },
    { kind: "avulso", title: "Serviços avulsos" },
  ];

  return (
    <>
      <PageHeader
        title="Pacotes do site"
        description="Planos mensais e serviços avulsos mostrados em Pacotes e na página inicial."
        actions={
          <>
            <ButtonLink href="/pacotes" external variant="secondary" icon={<ExternalLink />}>
              Ver no site
            </ButtonLink>
            <ButtonLink href="/painel/site/pacotes/novo" icon={<Plus />}>
              Novo pacote
            </ButtonLink>
          </>
        }
      />
      <PricingNotice />
      <div className="space-y-8">
        {groups.map(({ kind, title }) => {
          const group = all.filter((pkg) => pkg.kind === kind);
          return (
            <section key={kind} aria-labelledby={`grupo-${kind}`}>
              <h2 id={`grupo-${kind}`} className="text-grafite mb-3 text-lg font-bold">
                {title} <span className="text-cinza text-sm font-medium">({group.length})</span>
              </h2>
              <DataList
                caption={title}
                columns={columnsFor(group)}
                rows={group}
                rowKey={(pkg) => pkg.id}
                href={(pkg) => `/painel/site/pacotes/${pkg.id}`}
                empty={
                  <EmptyState
                    variant="plain"
                    icon={<PackageIcon />}
                    title={`Nenhum item em “${title}”`}
                    description="O site não mostra este bloco enquanto não houver nada publicado."
                    action={
                      <ButtonLink href={`/painel/site/pacotes/novo?tipo=${kind}`} icon={<Plus />}>
                        Novo pacote
                      </ButtonLink>
                    }
                  />
                }
              />
            </section>
          );
        })}
      </div>
    </>
  );
}
