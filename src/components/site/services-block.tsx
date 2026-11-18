/**
 * Bloco de um serviço na página /servicos: campo de cor (vira a capa quando o painel enviar a foto) de um
 * lado; título, resumo, descrição, lista do que o serviço cobre e os botões do outro. Os lados se alternam
 * (`flip`) e o serviço com página própria vira uma faixa de cor (`band`). Galeria e vídeo só aparecem
 * quando existirem — o bloco não depende deles.
 */
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/cn";
import { videoEmbedUrl } from "@/lib/format";
import type { PublicService } from "@/server/site/queries";
import { SiteButtonLink } from "./button";
import { PhotoSlot } from "./photo-slot";
import { revealProps } from "./reveal";
import { pad2, serviceContactHref, type SiteTone } from "./text";
import { VideoEmbed } from "./video-embed";

/** id do título de um serviço (para `aria-labelledby` e para o índice da página). */
export function serviceTitleId(slug: string): string {
  return `servicos-${slug}-titulo`;
}

export function ServicesBlock({
  service,
  index,
  total,
  fieldTone,
  flip = false,
  band,
  spaceTop,
  pageLink,
}: {
  service: PublicService;
  /** Posição na lista (0, 1, 2…). */
  index: number;
  total: number;
  /** Cor do campo enquanto não há capa. */
  fieldTone: SiteTone;
  /** Inverte os lados no desktop (campo à direita). */
  flip?: boolean;
  /** Faixa de cor em largura total (serviço em destaque). */
  band?: SiteTone;
  /** Respiro acima do fio (quando o bloco anterior era uma faixa de cor). */
  spaceTop?: "md" | "lg";
  /** Link para a página própria do serviço, quando existir e estiver publicada. */
  pageLink?: { label: string; href: string } | null;
}) {
  const titleId = serviceTitleId(service.slug);
  const hasVideo = Boolean(videoEmbedUrl(service.videoUrl));
  const top = spaceTop ?? (band ? "md" : undefined);
  return (
    <section
      id={service.slug}
      className={cn("s-section services__item", flip && "services__item--flip")}
      data-tone={band}
      data-space-top={top}
      aria-labelledby={titleId}
    >
      <div className="s-wrap">
        <div className="s-section__top">
          <span className="s-rule" aria-hidden="true" {...revealProps()} />
          <p className="s-section__idx services__idx" aria-hidden="true">
            <span className="s-section__n">{pad2(index + 1)}</span>
            <span className="services__idx-total">/{pad2(total)}</span>
          </p>
        </div>

        <div className="services__split">
          <PhotoSlot
            image={service.cover}
            alt={service.cover?.alt || service.title}
            tone={fieldTone}
            monogram={service.title}
            index={pad2(index + 1)}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="services__media"
            {...revealProps()}
          />
          <div className="services__body">
            <h2 id={titleId} className="services__title">
              {service.title}
            </h2>
            {service.summary ? <p className="s-lead services__summary">{service.summary}</p> : null}
            <Markdown className="s-prose services__desc">{service.description}</Markdown>
            {service.items.length > 0 ? (
              <ul className="services__list" aria-label={`${service.title}: o que inclui`}>
                {service.items.map((item, i) => (
                  <li key={i} {...revealProps(i % 4)}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="services__actions">
              <SiteButtonLink href={serviceContactHref(service.interest)}>{service.ctaLabel}</SiteButtonLink>
              {pageLink ? (
                <SiteButtonLink
                  href={pageLink.href}
                  variant="secondary"
                  aria-label={`${pageLink.label}: ${service.title}`}
                >
                  {pageLink.label}
                </SiteButtonLink>
              ) : null}
            </div>
          </div>
        </div>

        {hasVideo || service.gallery.length > 0 ? (
          <div className="services__extras">
            {hasVideo ? (
              <VideoEmbed
                url={service.videoUrl}
                title={service.title}
                poster={service.cover}
                className="services__video"
              />
            ) : null}
            {service.gallery.length > 0 ? (
              <ul className="services__gallery" aria-label={`${service.title}: galeria`}>
                {service.gallery.map((image, i) => (
                  <li key={`${image.id}-${i}`}>
                    <PhotoSlot
                      image={image}
                      ratio="4 / 5"
                      frame={false}
                      alt={image.alt || `${service.title} — foto ${i + 1}`}
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      {...revealProps(i % 4)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
