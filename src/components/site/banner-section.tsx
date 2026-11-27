/**
 * Topo da página inicial quando há banners no ar: o carrossel gerenciável (Editar site › Banners).
 * Server Component: monta cada <BannerSlide> aqui (com o Ó do logo) e entrega os banners prontos ao
 * <BannerCarousel>, que só cuida de qual está em tela.
 *
 * O <h1> da página é o título de abertura do site (Editar site › Textos › Página inicial), visível só para
 * leitores de tela e buscadores: os títulos dos banners giram, o da página não. Cada banner tem o seu <h2>.
 */
import { Logo } from "@/components/brand/logo";
import { env } from "@/lib/env";
import type { BannerView } from "@/lib/site/banners";
import { BannerCarousel } from "./banner-carousel";
import { BannerSlide } from "./banner-slide";

export function HomeBanners({ banners, title, eyebrow }: { banners: BannerView[]; title: string; eyebrow?: string }) {
  if (banners.length === 0) return null;
  const symbol = <Logo variant="simbolo" tone="branco" label="" className="h-full w-auto" />;
  return (
    <>
      {/* Sem JavaScript só o primeiro banner aparece: os controles (que não funcionariam) somem. */}
      <noscript>
        <style>{`.s-banners__bar{display:none!important}`}</style>
      </noscript>
      <BannerCarousel
        timeZone={env.timezone}
        heading={
          <h1 className="sr-only" id="banners-titulo">
            {title}
          </h1>
        }
        slides={banners.map((banner, index) => ({
          id: banner.id,
          durationSeconds: banner.durationSeconds,
          endsAt: banner.endsAt,
          content: <BannerSlide banner={banner} eyebrow={eyebrow} symbol={symbol} priority={index === 0} />,
        }))}
      />
    </>
  );
}
