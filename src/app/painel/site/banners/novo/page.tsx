import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { nowLocal } from "@/lib/dates";
import { BANNER_DURATION } from "@/lib/site/banners";
import { getSiteAvailability, getSiteContent } from "@/server/site/queries";
import { saveBannerAction } from "../actions";
import { BannerForm } from "../form";

export const metadata: Metadata = { title: "Novo banner" };
export const instant = false;

export default async function NewBannerPage() {
  await requirePermission("site", "editar");
  const [site, content] = await Promise.all([getSiteAvailability(), getSiteContent()]);
  return (
    <>
      <PageHeader
        title="Novo banner"
        description="Ele nasce desligado: confira a prévia no computador e no celular e ligue quando quiser que entre no carrossel."
        back={{ href: "/painel/site/banners", label: "Banners" }}
      />
      <BannerForm
        action={saveBannerAction}
        now={nowLocal()}
        site={site}
        eyebrow={content.home.hero.eyebrow}
        symbol={<Logo variant="simbolo" tone="branco" label="" className="h-full w-auto" />}
        initial={{
          id: null,
          name: "",
          layout: "tipografico",
          title: "",
          subtitle: "",
          buttonLabel: "",
          buttonUrl: "",
          secondaryLabel: "",
          secondaryUrl: "",
          desktop: null,
          mobile: null,
          video: null,
          alt: "",
          bgColor: "roxo",
          tone: "claro",
          durationSeconds: BANNER_DURATION.default,
          startsAt: "",
          endsAt: "",
          enabled: false,
        }}
      />
    </>
  );
}
