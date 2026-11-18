import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { saveAnnouncementAction } from "../actions";
import { AnnouncementForm } from "../form";

export const metadata: Metadata = { title: "Novo aviso" };
export const instant = false;

export default async function NewAnnouncementPage() {
  await requireUser();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo aviso" description="Ele nasce desligado: confira a prévia e ligue quando quiser que apareça no site." back={{ href: "/painel/site/avisos", label: "Avisos do site" }} />
      <Card>
        <AnnouncementForm
          action={saveAnnouncementAction}
          initial={{ id: null, message: "", linkLabel: "", linkUrl: "", bgColor: "roxo", textColor: "branco", startsAt: "", endsAt: "", dismissible: true, enabled: false }}
        />
      </Card>
    </div>
  );
}
