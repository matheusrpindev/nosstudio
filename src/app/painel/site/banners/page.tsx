import { GalleryHorizontalEnd, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatDate, nowLocal } from "@/lib/dates";
import { BANNER_LAYOUT_LABELS } from "@/lib/domain";
import { canEverywhere } from "@/lib/permissions";
import { BANNER_MAX_SLIDES, BANNER_SIZES, bannerStatus, bannerWarnings, buildBannerView, isViewRenderable } from "@/lib/site/banners";
import { getMediaByIds } from "@/server/media";
import { bannerMediaIds, listBanners } from "@/server/site/admin/banners";
import { getSiteAvailability, getSiteContent } from "@/server/site/queries";
import { deleteBannerFromListAction, duplicateBannerAction, moveBannerAction, reorderBannersAction, toggleBannerAction } from "./actions";
import { BannerList, type BannerRow } from "./list";

export const metadata: Metadata = { title: "Banners da página inicial" };
export const instant = false;

const formatLocal = (value: string) => `${formatDate(value.slice(0, 10))} às ${value.slice(11, 16)}`;

function period(startsAt: string | null, endsAt: string | null): string {
  if (startsAt && endsAt) return `De ${formatLocal(startsAt)} até ${formatLocal(endsAt)}`;
  if (startsAt) return `A partir de ${formatLocal(startsAt)}`;
  if (endsAt) return `Até ${formatLocal(endsAt)}`;
  return "Sem data para acabar";
}

export default async function BannersPage() {
  const user = await requirePermission("site", "ver");
  const [rows, site, content] = await Promise.all([listBanners(), getSiteAvailability(), getSiteContent()]);
  const files = await getMediaByIds(rows.flatMap(bannerMediaIds));
  const now = nowLocal();

  const list: BannerRow[] = rows.map((row) => {
    const view = buildBannerView(row, files, site);
    const size = (id: number | null) => {
      const file = id ? files.get(id) : undefined;
      return file ? { width: file.width, height: file.height } : null;
    };
    return {
      id: row.id,
      name: row.name || row.title || "Banner sem nome",
      layoutLabel: BANNER_LAYOUT_LABELS[row.layout],
      view,
      enabled: row.enabled,
      status: bannerStatus({ enabled: row.enabled, startsAt: row.startsAt, endsAt: row.endsAt, renderable: isViewRenderable(view) }, now),
      period: period(row.startsAt, row.endsAt),
      durationSeconds: row.durationSeconds,
      warnings: bannerWarnings(
        {
          layout: row.layout,
          title: row.title,
          alt: row.alt,
          buttonLabel: row.buttonLabel,
          buttonUrl: row.buttonUrl,
          secondaryLabel: row.secondaryLabel,
          secondaryUrl: row.secondaryUrl,
          desktop: size(row.desktopMediaId),
          mobile: size(row.mobileMediaId),
          hasVideo: Boolean(row.videoMediaId && files.get(row.videoMediaId)),
          enabled: row.enabled,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
        },
        now,
        site,
      ),
    };
  });
  const live = list.filter((row) => row.status === "no_ar").length;
  const canEdit = canEverywhere(user, "site", "editar");

  return (
    <>
      <PageHeader
        title="Banners da página inicial"
        description="O carrossel do topo do site: crie, ordene, agende e ligue ou desligue cada banner."
        actions={
          canEdit ? (
            <ButtonLink href="/painel/site/banners/novo" icon={<Plus />}>
              Novo banner
            </ButtonLink>
          ) : null
        }
      />

      <Alert tone="info" className="mb-5">
        O site mostra, nesta ordem, os banners <strong>ligados e dentro do período</strong> (no máximo {BANNER_MAX_SLIDES}). Sem nenhum no ar, a página inicial volta a mostrar a abertura padrão. Artes: {BANNER_SIZES.desktop.label} para computador e {BANNER_SIZES.mobile.label} para celular.
      </Alert>

      {list.length === 0 ? (
        <EmptyState
          icon={<GalleryHorizontalEnd />}
          title="Nenhum banner criado"
          description="A página inicial está com a abertura padrão. Crie um banner para destacar uma novidade, um serviço ou uma campanha."
          action={
            canEdit ? (
              <ButtonLink href="/painel/site/banners/novo" icon={<Plus />}>
                Criar o primeiro banner
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <>
          <p className="text-texto-suave mb-3 text-sm" role="status">
            {live === 0
              ? "Nenhum banner está no ar agora: a página inicial mostra a abertura padrão."
              : live === 1
                ? "1 banner no ar agora: aparece parado, sem setas nem indicadores."
                : `${Math.min(live, BANNER_MAX_SLIDES)} banners no ar agora, nesta ordem.${live > BANNER_MAX_SLIDES ? ` (Há ${live} ligados; só os ${BANNER_MAX_SLIDES} primeiros aparecem.)` : ""}`}
          </p>
          <BannerList
            rows={list}
            canEdit={canEdit}
            canDelete={canEverywhere(user, "site", "excluir")}
            eyebrow={content.home.hero.eyebrow}
            symbol={<Logo variant="simbolo" tone="branco" label="" className="h-full w-auto" />}
            moveAction={moveBannerAction}
            reorderAction={reorderBannersAction}
            toggleAction={toggleBannerAction}
            duplicateAction={duplicateBannerAction}
            deleteAction={deleteBannerFromListAction}
          />
        </>
      )}
    </>
  );
}
