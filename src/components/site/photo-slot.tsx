/**
 * <PhotoSlot>: o "espaço de foto" do sistema. Com foto, mostra a imagem (com srcset) dentro da moldura do
 * visor. Sem foto, mostra o estado vazio intencional da marca: campo de cor chapada + monograma gigante (ou
 * símbolo) + cantoneiras. Trocar o estado vazio pela foto real nunca muda o tamanho do bloco.
 */
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import type { PublicImage } from "@/lib/media";
import { ViewfinderFrame } from "./marks";
import { SiteImage } from "./site-image";
import { monogramOf, type SiteTone } from "./text";

export type PhotoRatio = "4 / 5" | "3 / 4" | "1 / 1" | "3 / 2" | "16 / 9" | "16 / 10" | "9 / 16";

type PhotoSlotProps = {
  /** A imagem (de `getSiteImages()`, `service.cover`, `project.cover`…) ou `null` enquanto não existir. */
  image: PublicImage | null | undefined;
  /** Proporção do campo. Padrão 4:5 (retrato). */
  ratio?: PhotoRatio;
  /** Cor do campo no estado vazio. Alterne roxo/lavanda/grafite em conjuntos. */
  tone?: SiteTone;
  /** Estado vazio: nome (ou letra) para o monograma gigante. Ex.: `monogram={founder.name}` → "P". */
  monogram?: string;
  /** Estado vazio alternativo: um símbolo centralizado. Sem `monogram` nem `symbol`, usa o Ó do logo. */
  symbol?: ReactNode;
  /** Pequeno índice no canto ("01"). */
  index?: string;
  /** Legenda (<figcaption>): use <strong> para o nome e <span> para o complemento. */
  caption?: ReactNode;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  /** Cantoneiras do visor por cima (padrão: sim). */
  frame?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function PhotoSlot({
  image,
  ratio = "4 / 5",
  tone = "roxo",
  monogram,
  symbol,
  index,
  caption,
  alt,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority,
  frame = true,
  className,
  style,
  ...rest
}: PhotoSlotProps & { "data-reveal"?: "" }) {
  const letter = monogram ? monogramOf(monogram) : "";
  return (
    <figure className={cn("s-photo", className)} style={style} {...rest}>
      <div
        className="s-photo__field"
        data-tone={tone}
        data-media={image ? "photo" : "empty"}
        style={{ "--ratio": ratio } as CSSProperties}
      >
        {image ? (
          <SiteImage image={image} alt={alt} sizes={sizes} priority={priority} className="s-media" />
        ) : letter ? (
          <span className="s-photo__letter" aria-hidden="true">
            {letter}
          </span>
        ) : (
          <span className="s-photo__symbol" aria-hidden="true">
            {symbol ?? <Logo variant="simbolo" tone={tone === "roxo" || tone === "grafite" ? "branco" : "roxo"} label="" className="h-auto w-[34%]" />}
          </span>
        )}
        {frame ? <ViewfinderFrame /> : null}
        {index ? (
          <span className="s-photo__n" aria-hidden="true">
            {index}
          </span>
        ) : null}
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
