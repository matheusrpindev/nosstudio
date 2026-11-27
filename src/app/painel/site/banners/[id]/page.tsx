import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { nowLocal } from "@/lib/dates";
import { canEverywhere } from "@/lib/permissions";
import { getMediaValue } from "@/server/media";
import { getBanner } from "@/server/site/admin/banners";
import { getSiteAvailability, getSiteContent } from "@/server/site/queries";
import { deleteBannerAction, duplicateBannerAction, saveBannerAction } from "../actions";
import { BannerForm } from "../form";
import { DuplicateButton } from "../list";

export const metadata: Metadata = { title: "Editar banner" };
export const instant = false;

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("site", "editar");
  const id = paramId((await params).id);
  const row = id ? await getBanner(id) : null;
  if (!row) notFound();
  const [site, content, desktop, mobile, video] = await Promise.all([
    getSiteAvailability(),
    getSiteContent(),
    getMediaValue(row.desktopMediaId),
    getMediaValue(row.mobileMediaId),
    getMediaValue(row.videoMediaId),
  ]);

  return (
    <>
      <PageHeader
        title="Editar banner"
        description={row.name || row.title || undefined}
        back={{ href: "/painel/site/banners", label: "Banners" }}
        actions={
          <>
            <DuplicateButton id={row.id} action={duplicateBannerAction} />
            {canEverywhere(user, "site", "excluir") ? (
              <ConfirmDialog
                trigger={
                  <Button variant="danger-ghost" icon={<Trash2 />}>
                    Excluir banner
                  </Button>
                }
                title="Excluir este banner?"
                description="Ele sai do carrossel e não dá para recuperar. Para só tirar do ar por um tempo, desligue o banner em vez de excluir."
                confirmLabel="Excluir banner"
                action={deleteBannerAction}
                hidden={{ id: row.id }}
              />
            ) : null}
          </>
        }
      />
      <BannerForm
        // a cópia de um banner abre nesta mesma rota: `key` garante um formulário novo a cada banner
        key={row.id}
        action={saveBannerAction}
        now={nowLocal()}
        site={site}
        eyebrow={content.home.hero.eyebrow}
        symbol={<Logo variant="simbolo" tone="branco" label="" className="h-full w-auto" />}
        initial={{
          id: row.id,
          name: row.name,
          layout: row.layout,
          title: row.title,
          subtitle: row.subtitle,
          buttonLabel: row.buttonLabel,
          buttonUrl: row.buttonUrl,
          secondaryLabel: row.secondaryLabel,
          secondaryUrl: row.secondaryUrl,
          desktop,
          mobile,
          video,
          alt: row.alt,
          bgColor: row.bgColor,
          tone: row.tone,
          durationSeconds: row.durationSeconds,
          startsAt: row.startsAt ?? "",
          endsAt: row.endsAt ?? "",
          enabled: row.enabled,
        }}
      />
    </>
  );
}
