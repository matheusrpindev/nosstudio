/**
 * Blocos da página inicial do briefing v2 (Server Components):
 * - <ServiceIndex>: índice tipográfico dos serviços publicados — uma linha por serviço, a linha inteira é o link;
 * - <DifferentialsList>: os diferenciais em grade numerada (o texto de cada um é opcional);
 * - <StandaloneIndex>: os serviços avulsos em linhas curtas, cada uma leva ao formulário com o serviço escolhido.
 * Todos funcionam com qualquer quantidade de itens e não renderizam nada com a lista vazia.
 */
import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { servicePath } from "@/lib/site/paths";
import type { PublicPackage, PublicService } from "@/server/site/queries";
import { Icon } from "./marks";
import { revealProps } from "./reveal";
import { packageContactHref, pad2 } from "./text";

// --------------------------------------------------------- índice de serviços
export function ServiceIndex({
  services,
  linkLabel,
  headingLevel = 3,
  className,
}: {
  services: Pick<PublicService, "id" | "slug" | "title" | "summary" | "items">[];
  /** Complemento do nome acessível do link ("Ver o serviço"). */
  linkLabel?: string;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  if (services.length === 0) return null;
  const Title = `h${headingLevel}` as "h2" | "h3";
  return (
    <ol className={cn("s-index", className)}>
      {services.map((service, i) => {
        // sem resumo cadastrado, a linha mostra as possíveis entregas do serviço
        const text = service.summary || service.items.join(" · ");
        return (
        <li key={service.id} className="s-index__row" {...revealProps(i % 4)}>
          <Link href={servicePath(service.slug)} className="s-index__link" aria-label={linkLabel ? `${linkLabel}: ${service.title}` : undefined}>
            <span className="s-index__n" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <Title className="s-index__title">{service.title}</Title>
            {text ? <p className="s-index__text">{text}</p> : <span />}
            <Icon name="arrow" className="s-index__arrow" />
          </Link>
        </li>
        );
      })}
    </ol>
  );
}

// --------------------------------------------------------------- diferenciais
export function DifferentialsList({
  items,
  headingLevel = 3,
  className,
}: {
  items: { title: string; text: string }[];
  headingLevel?: 3 | 4;
  className?: string;
}) {
  if (items.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  const cols = items.length === 4 ? 2 : items.length < 3 ? items.length : 3;
  return (
    <ol className={cn("s-diffs", className)} style={{ "--cols": cols } as CSSProperties}>
      {items.map((item, i) => (
        <li key={i} className="s-diff" {...revealProps(i % 3)}>
          <span className="s-diff__n" aria-hidden="true">
            {pad2(i + 1)}
          </span>
          <Title className="s-diff__title">{item.title}</Title>
          {item.text ? <p className="s-diff__text">{item.text}</p> : null}
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------ serviços avulsos
export function StandaloneIndex({
  packages,
  headingLevel = 3,
  className,
}: {
  packages: Pick<PublicPackage, "id" | "kind" | "name" | "tagline" | "ctaLabel">[];
  headingLevel?: 3 | 4;
  className?: string;
}) {
  if (packages.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  return (
    <ul className={cn("s-solo", className)}>
      {packages.map((pkg, i) => (
        <li key={pkg.id} className="s-solo__item" {...revealProps(i % 3)}>
          <Link href={packageContactHref(pkg)} className="s-solo__link" aria-label={`${pkg.ctaLabel}: ${pkg.name}`}>
            <span className="s-solo__n" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <Title className="s-solo__name">{pkg.name}</Title>
            <Icon name="arrow-ne" className="s-solo__arrow" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
