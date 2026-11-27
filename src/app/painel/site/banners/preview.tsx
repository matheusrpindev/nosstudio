"use client";

/**
 * Prévia de um banner dentro do painel, com o MESMO componente do site (<BannerSlide>) e o CSS do site.
 *
 * - O bloco é claro (`tema-claro` + `site`): mostra as cores reais do site, sempre com borda.
 * - O banner se monta pela largura do bloco (banner.css usa consultas de contêiner): a moldura "computador" tem
 *   1440px e a "celular" 390px, reduzidas para caber na tela (`transform: scale`), sem mudar a montagem.
 * - É só para olhar: os botões e links de dentro não respondem (`inert`), e leitores de tela recebem um resumo.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BannerSlide, BannerStill } from "@/components/site/banner-slide";
import { cn } from "@/lib/cn";
import type { BannerView, BannerViewport } from "@/lib/site/banners";
import "@/app/(site)/site.css";

/** Largura "de verdade" de cada moldura, em px. */
export const PREVIEW_WIDTHS: Record<BannerViewport, number> = { desktop: 1440, mobile: 390 };

/** Renderiza `children` com `width` px de largura e reduz (nunca amplia) para caber no espaço disponível. */
function ScaledFrame({ width, children, className }: { width: number; children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ scale: number; height: number } | null>(null);

  useEffect(() => {
    const outerEl = outer.current;
    const innerEl = inner.current;
    if (!outerEl || !innerEl) return;
    const measure = () => {
      const scale = Math.min(1, outerEl.clientWidth / width);
      const height = innerEl.offsetHeight * scale;
      setBox((previous) => (previous && Math.abs(previous.scale - scale) < 0.0005 && Math.abs(previous.height - height) < 0.5 ? previous : { scale, height }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(outerEl);
    observer.observe(innerEl);
    measure();
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outer} className={cn("overflow-hidden", className)} style={{ height: box ? box.height : undefined, maxWidth: width }}>
      <div ref={inner} style={{ width, transform: box ? `scale(${box.scale})` : undefined, transformOrigin: "0 0", visibility: box ? undefined : "hidden" }}>
        {children}
      </div>
    </div>
  );
}

export function BannerPreview({
  banner,
  viewport,
  eyebrow,
  symbol,
  className,
}: {
  banner: BannerView;
  viewport: BannerViewport;
  /** Linha de apoio do site ("Marketing • Conteúdo • Audiovisual"). */
  eyebrow?: string;
  /** O Ó do logo, vindo de um Server Component (ver <BannerSlide>). */
  symbol?: ReactNode;
  className?: string;
}) {
  const summary = [banner.title, banner.subtitle].filter(Boolean).join(" — ") || "banner sem texto";
  return (
    <div
      className={cn("tema-claro border-borda-forte overflow-hidden rounded-md border", className)}
      style={{ maxWidth: PREVIEW_WIDTHS[viewport] }}
      role="img"
      aria-label={`Prévia no ${viewport === "desktop" ? "computador" : "celular"}: ${summary}`}
    >
      <ScaledFrame width={PREVIEW_WIDTHS[viewport]}>
        <div className="site" style={{ display: "block" }} inert>
          <BannerStill>
            <BannerSlide banner={banner} eyebrow={eyebrow} symbol={symbol} viewport={viewport} titleAs="p" priority />
          </BannerStill>
        </div>
      </ScaledFrame>
    </div>
  );
}
