import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { getMediaValue } from "@/server/media";
import { getTestimonial } from "@/server/site/admin/testimonials";
import { getSiteContentForEdit } from "@/server/site/content";
import { SectionHiddenNotice } from "../../_colecoes/hidden-notice";
import { deleteTestimonialAction, saveTestimonialAction } from "../actions";
import { TestimonialForm } from "../form";
import { AuthorizationNotice } from "../notice";

export const metadata: Metadata = { title: "Editar depoimento" };
export const instant = false;

export default async function EditTestimonialPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = paramId((await params).id);
  const item = id ? await getTestimonial(id) : null;
  if (!item) notFound();
  const [media, visibility] = await Promise.all([getMediaValue(item.mediaId), getSiteContentForEdit("visibility")]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Editar depoimento"
        description={item.authorName}
        back={{ href: "/painel/site/depoimentos", label: "Depoimentos do site" }}
        actions={
          <ConfirmDialog
            trigger={
              <Button variant="danger-ghost" icon={<Trash2 />}>
                Excluir depoimento
              </Button>
            }
            title="Excluir este depoimento?"
            description="Ele sai do site e não dá para recuperar. Para só tirar do ar, deixe como rascunho."
            confirmLabel="Excluir depoimento"
            action={deleteTestimonialAction}
            hidden={{ id: item.id }}
          />
        }
      />
      <SectionHiddenNotice hidden={!visibility.testimonials} title="A seção de depoimentos está oculta no site" />
      <AuthorizationNotice />
      <Card>
        <TestimonialForm
          action={saveTestimonialAction}
          media={media}
          initial={{
            id: item.id,
            kind: item.kind,
            authorName: item.authorName,
            authorRole: item.authorRole,
            content: item.content,
            mediaAlt: item.mediaAlt,
            videoUrl: item.videoUrl ?? "",
            authorized: item.authorized,
            published: item.published,
          }}
        />
      </Card>
    </div>
  );
}
