/**
 * Hero da página inicial: o título gigante cruza do papel para dentro do campo de cor (com inversão de cor
 * exatamente na borda do campo), emoldurado pelas cantoneiras do visor.
 *
 * Mídia: com `image`, a foto real cobre o campo (moldura e legenda continuam por cima); sem imagem, o
 * estado gráfico da marca — campo roxo + o Ó do logo.
 */
import type { CSSProperties } from "react";
import { Logo } from "@/components/brand/logo";
import type { PublicImage } from "@/lib/media";
import type { SiteLink as SiteLinkContent } from "@/lib/site/content";
import { SiteButtonLink } from "./button";
import { Icon, RecDot, ViewfinderFrame } from "./marks";
import { SiteImage } from "./site-image";
import { splitTitle, titleMetrics } from "./text";

export function HomeHero({
  eyebrow,
  title,
  lead,
  text,
  primaryCta,
  secondaryCta,
  image,
  caption,
  aside,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  text?: string;
  /** Botão de contorno (ex.: "Conheça nossos serviços"). */
  primaryCta: SiteLinkContent;
  /** Botão lima (ex.: "Vamos criar juntos"). */
  secondaryCta: SiteLinkContent;
  image: PublicImage | null;
  /** Linhas da legenda dentro da moldura (a primeira em destaque). */
  caption?: string[];
  /** Link discreto à direita do rótulo (ex.: Instagram). */
  aside?: { label: string; href: string } | null;
}) {
  const [line1, line2] = splitTitle(title);
  const metrics = titleMetrics([line1, line2]);
  const fit = { "--hero-word": metrics.word, "--hero-line": metrics.line } as CSSProperties;
  const lines = (
    <>
      <span className="l1">{line1}</span>
      {line2 ? (
        <>
          {" "}
          <span className="l2">{line2}</span>
        </>
      ) : null}
    </>
  );
  const captionLines = (caption ?? []).filter(Boolean);

  return (
    <section className="s-hero" aria-labelledby="hero-titulo">
      <div className="s-wrap s-hero__stage">
        <div className="s-hero__meta">
          <p className="s-meta">{eyebrow}</p>
          {aside?.href ? (
            <a className="s-meta s-hero__insta" href={aside.href} target="_blank" rel="noopener noreferrer">
              {aside.label} <Icon name="arrow-ne" />
            </a>
          ) : null}
        </div>

        <h1 className="s-hero__title" id="hero-titulo" style={fit}>
          {lines}
        </h1>
        {/* Eco do título: mesma caixa e mesma quebra, recortado pela borda do campo de cor. Decorativo. */}
        <p className="s-hero__title s-hero__echo" aria-hidden="true" style={fit}>
          {lines}
        </p>

        <div className="s-hero__text">
          {lead ? <p className="s-lead">{lead}</p> : null}
          {text ? <p>{text}</p> : null}
        </div>

        <div className="s-hero__actions">
          <SiteButtonLink href={primaryCta.href} variant="secondary">
            {primaryCta.label}
          </SiteButtonLink>
          <SiteButtonLink href={secondaryCta.href}>{secondaryCta.label}</SiteButtonLink>
        </div>

        <figure className="s-hero__field" data-tone="roxo" data-media={image ? "photo" : "empty"}>
          {image ? (
            <SiteImage image={image} priority sizes="(min-width: 1024px) 45vw, 100vw" className="s-media" />
          ) : (
            <span className="s-hero__symbol" aria-hidden="true">
              <Logo variant="simbolo" tone="branco" label="" className="h-full w-auto" />
            </span>
          )}
          <ViewfinderFrame />
          <RecDot className="s-hero__rec" />
          {captionLines.length > 0 ? (
            <figcaption className="s-hero__caption">
              {captionLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </figcaption>
          ) : null}
        </figure>
      </div>
    </section>
  );
}
