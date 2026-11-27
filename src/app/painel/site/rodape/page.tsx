import { ExternalLink, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { canEverywhere } from "@/lib/permissions";
import { getMediaValues } from "@/server/media";
import { getSiteContentForEdit } from "@/server/site/content";
import { getFooterExperienceForEdit } from "@/server/site/footer-experience";
import { saveFooterExperienceAction } from "./actions";
import { FooterExperienceForm } from "./form";

export const metadata: Metadata = { title: "Rodapé interativo" };
export const instant = false;

/**
 * Rodapé interativo (briefing v2, seção 11): câmera e celular simulados logo acima do rodapé institucional, com o
 * contador de visitas. Aqui: ligar/desligar e as fotos/trechos. Os textos ficam em Textos › Rodapé interativo.
 */
export default async function FooterExperiencePage() {
  const user = await requirePermission("site", "ver");
  const canEdit = canEverywhere(user, "site", "editar");
  const [{ settings }, counter] = await Promise.all([getFooterExperienceForEdit(), getSiteContentForEdit("visitCounter")]);
  const [photos, clipMedia] = await Promise.all([getMediaValues(settings.photos.map((photo) => photo.mediaId)), getMediaValues(settings.clips.map((clip) => clip.mediaId))]);
  const clips = settings.clips.flatMap((clip) => {
    const media = clipMedia.find((item) => item.id === clip.mediaId) ?? null;
    return media ? [{ media, caption: clip.caption }] : [];
  });

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Rodapé interativo"
        description="“Antes de ir, deixe sua marca.” A câmera e o celular que aparecem no fim de todas as páginas do site, junto com o contador de visitas."
        actions={
          <ButtonLink href="/#rodape-interativo" external variant="secondary" icon={<ExternalLink />}>
            Ver no site
          </ButtonLink>
        }
      />

      <Alert tone="info" title="É uma simulação" className="mb-6">
        O visitante clica na câmera e uma foto instantânea é revelada; no celular, aperta REC e vê um cronômetro e os trechos de vídeo. O site nunca usa a câmera
        nem o microfone de quem visita, e nada é gravado. O som vem desligado e só toca se o visitante ligar.
      </Alert>

      <FooterExperienceForm key={settings.photos.length + ":" + settings.clips.length} action={saveFooterExperienceAction} canEdit={canEdit} initial={{ enabled: settings.enabled, photos, clips }} />

      <Card as="section" aria-labelledby="rodape-textos" className="mt-8">
        <CardHeader
          id="rodape-textos"
          title="Textos e contador"
          description={`Título, subtítulo, legendas e o aviso de simulação são editados em Textos. O contador de visitas entra dentro do rodapé interativo; hoje ele está ${counter.enabled ? "ligado" : "desligado"}.`}
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <ButtonLink href="/painel/site/textos/footerExperience" variant="secondary" icon={<PenLine />}>
            Editar os textos
          </ButtonLink>
          <ButtonLink href="/painel/site/textos/visitCounter" variant="secondary">
            Contador de visitas
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
