/**
 * "Quem estará no dia": Pedro e Laura em versão compacta (retrato ou monograma, nome, papel e resumo).
 * O espaço 3:4 recebe o retrato real quando o painel enviar; sem foto, o monograma da marca.
 */
import type { PublicImage } from "@/lib/media";
import type { FounderContent } from "@/lib/site/content";
import { PhotoSlot } from "./photo-slot";
import { revealProps } from "./reveal";
import { displayRole, pad2 } from "./text";

export function WeddingsCrew({
  founders,
  images,
}: {
  founders: FounderContent[];
  images: (PublicImage | null | undefined)[];
}) {
  if (founders.length === 0) return null;
  return (
    <ul className="weddings-crew" data-count={Math.min(founders.length, 4)}>
      {founders.map((founder, i) => (
        <li key={founder.name} className="weddings-crew__item" {...revealProps(i)}>
          <PhotoSlot
            image={images[i]}
            alt={images[i]?.alt || `Retrato de ${founder.name}`}
            ratio="3 / 4"
            tone={i % 2 === 0 ? "roxo" : "lavanda"}
            monogram={founder.name}
            index={pad2(i + 1)}
            sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 100vw"
          />
          <div className="weddings-crew__text">
            <h3 className="s-h3">{founder.name}</h3>
            {founder.role ? <p className="s-meta weddings-crew__role">{displayRole(founder.role)}</p> : null}
            {founder.shortBio ? <p className="s-muted">{founder.shortBio}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
