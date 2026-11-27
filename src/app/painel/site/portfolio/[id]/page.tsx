import { ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { projectMediaIds, type PublishBlockers } from "@/lib/site/portfolio";
import { getMediaValues } from "@/server/media";
import { findPublishBlockers, getPortfolioProject, listRelatedOptions } from "@/server/site/admin/portfolio";
import { getSiteContentForEdit } from "@/server/site/content";
import { SectionHiddenNotice } from "../../_colecoes/hidden-notice";
import { deletePortfolioAction, savePortfolioAction } from "../actions";
import { PortfolioForm, type PortfolioFormMedia } from "../form";
import { RealWorkNotice } from "../notice";

export const metadata: Metadata = { title: "Editar projeto" };
export const instant = false;

export default async function EditPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("site", "editar");
  const id = paramId((await params).id);
  const project = id ? await getPortfolioProject(id) : null;
  if (!project) notFound();
  const [values, related, visibility, blockers] = await Promise.all([
    getMediaValues(projectMediaIds(project)),
    listRelatedOptions(project.id),
    getSiteContentForEdit("visibility"),
    project.published ? ({} as PublishBlockers) : findPublishBlockers(project),
  ]);
  const byId = new Map(values.map((value) => [value.id, value]));
  const pick = (ids: number[]) => ids.flatMap((mediaId) => byId.get(mediaId) ?? []);
  const media: PortfolioFormMedia = {
    cover: project.coverMediaId ? (byId.get(project.coverMediaId) ?? null) : null,
    gallery: pick(project.gallery),
    backstage: pick(project.backstage),
    beforeAfter: project.beforeAfter.map((pair) => ({ before: byId.get(pair.beforeMediaId) ?? null, after: byId.get(pair.afterMediaId) ?? null, caption: pair.caption })),
  };
  const pending = Object.values(blockers);

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
              description="Ele sai do site e não dá para recuperar. As imagens dele (capa, galeria, bastidores, antes e depois) são apagadas junto. Para só tirar do ar, deixe como rascunho."
              confirmLabel="Excluir projeto"
              action={deletePortfolioAction}
              hidden={{ id: project.id }}
            />
          </>
        }
      />
      <SectionHiddenNotice hidden={!visibility.portfolio} title="O portfólio está oculto no site" />
      <RealWorkNotice />
      {pending.length > 0 ? (
        <Alert tone="alerta" title="Rascunho: ainda falta para poder publicar" className="mb-5">
          <ul className="list-disc space-y-0.5 pl-5">
            {pending.map((message) => (
              <li key={message}>{message.replace(/^Para publicar, /, "").replace(/^./, (first) => first.toUpperCase())}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <PortfolioForm action={savePortfolioAction} project={project} media={media} related={related} />
    </div>
  );
}
