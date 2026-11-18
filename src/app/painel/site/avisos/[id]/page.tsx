import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { getAnnouncement } from "@/server/site/admin/announcements";
import { deleteAnnouncementAction, saveAnnouncementAction } from "../actions";
import { AnnouncementForm } from "../form";

export const metadata: Metadata = { title: "Editar aviso" };
export const instant = false;

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = paramId((await params).id);
  const row = id ? await getAnnouncement(id) : null;
  if (!row) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Editar aviso"
        back={{ href: "/painel/site/avisos", label: "Avisos do site" }}
        actions={
          <ConfirmDialog
            trigger={
              <Button variant="danger-ghost" icon={<Trash2 />}>
                Excluir aviso
              </Button>
            }
            title="Excluir este aviso?"
            description="Ele sai do site e não dá para recuperar. Para só tirar do ar por um tempo, desligue o aviso em vez de excluir."
            confirmLabel="Excluir aviso"
            action={deleteAnnouncementAction}
            hidden={{ id: row.id }}
          />
        }
      />
      <Card>
        <AnnouncementForm
          action={saveAnnouncementAction}
          initial={{
            id: row.id,
            message: row.message,
            linkLabel: row.linkLabel ?? "",
            linkUrl: row.linkUrl ?? "",
            bgColor: row.bgColor,
            textColor: row.textColor,
            startsAt: row.startsAt ?? "",
            endsAt: row.endsAt ?? "",
            dismissible: row.dismissible,
            enabled: row.enabled,
          }}
        />
      </Card>
    </div>
  );
}
