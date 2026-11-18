import { ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { getMediaValue, getMediaValues } from "@/server/media";
import { getPortfolioProject } from "@/server/site/admin/portfolio";
import { getSiteContentForEdit } from "@/server/site/content";
import { SectionHiddenNotice } from "../../_colecoes/hidden-notice";
import { deletePortfolioAction, savePortfolioAction } from "../actions";
import { PortfolioForm } from "../form";
import { RealWorkNotice } from "../notice";

export const metadata: Metadata = { title: "Editar projeto" };
export const instant = false;

export default async function EditPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = paramId((await params).id);
  const project = id ? await getPortfolioProject(id) : null;
  if (!project) notFound();
  const [cover, gallery, visibility] = await Promise.all([getMediaValue(project.coverMediaId), getMediaValues(project.gallery), getSiteContentForEdit("visibility")]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={project.title}
        back={{ href: "/painel/site/portfolio", label: "Portfólio do site" }}
        actions={
          <>
            {project.published ? (
              <ButtonLink href={`/portfolio/${project.slug}`} external variant="secondary" icon={<ExternalLink />}>
                Ver no site
              </ButtonLink>
            ) : null}
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Trash2 />}>
                  Excluir projeto
                </Button>
              }
              title="Excluir este projeto?"
              description="Ele sai do site e não dá para recuperar. As imagens continuam na biblioteca. Para só tirar do ar, deixe como rascunho."
              confirmLabel="Excluir projeto"
              action={deletePortfolioAction}
              hidden={{ id: project.id }}
            />
          </>
        }
      />
      <SectionHiddenNotice hidden={!visibility.portfolio} title="O portfólio está oculto no site" />
      <RealWorkNotice />
      <Card>
        <PortfolioForm action={savePortfolioAction} project={project} cover={cover} gallery={gallery} />
      </Card>
    </div>
  );
}
