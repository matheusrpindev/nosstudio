/**
 * Galeria de um projeto: imagens com width/height (sem pulo de layout), srcset e carregamento lazy.
 * A primeira ocupa a largura toda quando for paisagem; as demais em duas colunas.
 */
import type { PublicImage } from "@/lib/media";
import { ViewfinderFrame } from "./marks";
import { revealProps } from "./reveal";
import { SiteImage } from "./site-image";

export function PortfolioProjectGallery({ images, title }: { images: PublicImage[]; title: string }) {
  if (images.length === 0) return null;
  return (
    <ul className="portfolio-gallery">
      {images.map((image, i) => {
        const wide = i === 0 && image.width >= image.height;
        return (
          <li key={image.id} className="portfolio-gallery__item" data-wide={wide || undefined} {...revealProps(i % 2)}>
            <figure>
              <SiteImage
                image={image}
                alt={image.alt || `${title} — imagem ${i + 1} de ${images.length}`}
                sizes={wide ? "(min-width: 1440px) 1330px, 100vw" : "(min-width: 768px) 50vw, 100vw"}
              />
              <ViewfinderFrame />
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
