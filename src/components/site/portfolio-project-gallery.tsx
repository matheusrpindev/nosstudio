"use client";

/**
 * Galeria de um projeto, com ampliação: cada miniatura é um botão que abre a imagem no <PortfolioLightbox>.
 * Miniaturas com width/height (sem pulo de layout), srcset e carregamento lazy.
 * - `variant="gallery"`: a primeira ocupa a largura toda quando for paisagem; as demais em duas colunas.
 * - `variant="backstage"`: grade mais densa, de miniaturas iguais (bastidores).
 */
import { useRef, useState } from "react";
import type { PublicImage } from "@/lib/media";
import { ViewfinderFrame } from "./marks";
import { PortfolioLightbox } from "./portfolio-lightbox";
import { revealProps } from "./reveal";
import { SiteImage } from "./site-image";

export function PortfolioProjectGallery({
  images,
  label,
  variant = "gallery",
}: {
  images: PublicImage[];
  /** Nome da galeria para leitores de tela ("Galeria do projeto X"). */
  label: string;
  variant?: "gallery" | "backstage";
}) {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  if (images.length === 0) return null;
  const backstage = variant === "backstage";

  return (
    <>
      <ul className="portfolio-gallery" data-variant={variant}>
        {images.map((image, i) => {
          const wide = !backstage && i === 0 && image.width >= image.height;
          const description = image.alt || `imagem ${i + 1} de ${images.length}`;
          return (
            <li key={image.id} className="portfolio-gallery__item" data-wide={wide || undefined} {...revealProps(i % (backstage ? 4 : 2))}>
              <button
                type="button"
                className="portfolio-gallery__open"
                aria-haspopup="dialog"
                aria-label={`Ampliar: ${description}`}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setOpen(i);
                }}
              >
                <SiteImage
                  image={image}
                  alt=""
                  sizes={backstage ? "(min-width: 1024px) 25vw, 50vw" : wide ? "(min-width: 1440px) 1330px, 100vw" : "(min-width: 768px) 50vw, 100vw"}
                />
                {backstage ? null : <ViewfinderFrame />}
                <span className="portfolio-gallery__zoom" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                  </svg>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open !== null ? (
        <PortfolioLightbox
          images={images}
          index={open}
          label={label}
          onIndexChange={setOpen}
          onClose={() => {
            setOpen(null);
            // o <dialog> já devolve o foco a quem abriu; isto cobre navegadores que não o fazem
            opener.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
    </>
  );
}
