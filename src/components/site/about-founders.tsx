/**
 * Fundadores lado a lado (página /sobre): retrato 4:5 (ou o monograma, enquanto a foto não existe), nome,
 * papel e a bio COMPLETA, em markdown — o texto é dos sócios e entra como está.
 */
import type { CSSProperties } from "react";
import { Markdown } from "@/components/markdown";
import type { PublicImage } from "@/lib/media";
import type { FounderContent } from "@/lib/site/content";
import { PhotoSlot } from "./photo-slot";
import { revealProps } from "./reveal";
import { displayRole, pad2 } from "./text";

export function AboutFounders({
  founders,
  images,
  headingLevel = 3,
}: {
  founders: FounderContent[];
  /** Retratos na mesma ordem dos fundadores (`getSiteImages().founders`). */
  images: (PublicImage | null)[];
  headingLevel?: 3 | 4;
}) {
  if (founders.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  return (
    <ul className="about__founders" style={{ "--count": founders.length } as CSSProperties}>
      {founders.map((founder, i) => (
        <li key={founder.name} className="about__founder">
          <PhotoSlot
            image={images[i]}
            alt={images[i]?.alt || `Retrato de ${founder.name}`}
            tone={i % 2 === 0 ? "roxo" : "lavanda"}
            monogram={founder.name}
            index={pad2(i + 1)}
            ratio="4 / 5"
            sizes="(min-width: 1024px) 40vw, 100vw"
            {...revealProps(i)}
          />
          <div className="about__founder-id">
            <Title className="about__founder-name">{founder.name}</Title>
            {founder.role ? <p className="about__founder-role">{displayRole(founder.role)}</p> : null}
          </div>
          <Markdown className="s-prose about__founder-bio">{founder.bio || founder.shortBio}</Markdown>
        </li>
      ))}
    </ul>
  );
}
