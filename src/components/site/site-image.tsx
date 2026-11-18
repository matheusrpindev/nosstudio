/**
 * <SiteImage>: <img> com `srcset` das versões geradas no upload, `width`/`height` (sem pulo de layout) e a
 * cor dominante como fundo enquanto carrega. Os arquivos saem de /media (pipeline próprio de upload), por
 * isso não usamos next/image. Arquivo puro: serve em Server e Client Components.
 */
import type { CSSProperties } from "react";
import { imageSrcSet, type PublicImage } from "@/lib/media";

type SiteImageProps = {
  image: PublicImage;
  /** Texto alternativo. Padrão: o `alt` cadastrado na mídia. Passe `""` se a imagem for decorativa. */
  alt?: string;
  /** Atributo `sizes` (largura que a imagem ocupa na tela). Ex.: "(min-width: 1024px) 33vw, 100vw". */
  sizes?: string;
  /** Imagem acima da dobra (hero): carrega com prioridade em vez de `loading="lazy"`. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function SiteImage({ image, alt, sizes = "100vw", priority = false, className, style }: SiteImageProps) {
  const srcSet = imageSrcSet(image);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- as versões responsivas já vêm do pipeline de upload
    <img
      src={image.url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
      style={{ backgroundColor: image.placeholderColor ?? undefined, ...style }}
    />
  );
}
