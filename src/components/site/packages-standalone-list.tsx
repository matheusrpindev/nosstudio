/**
 * Serviços avulsos em lista enxuta (página /pacotes): uma linha por serviço, com fio, numeração, preço
 * conforme `priceMode` e o botão de orçamento. Detalhes (o que inclui, entregas, captação, revisões) só
 * aparecem quando os sócios preencherem no painel.
 */
import type { PublicPackage } from "@/server/site/queries";
import { SiteButtonLink } from "./button";
import { hasPublicPrice, PackagePrice } from "./package-card";
import { revealProps } from "./reveal";
import { packageContactHref, pad2 } from "./text";

export function PackagesStandaloneList({
  packages,
  headingLevel = 3,
}: {
  packages: PublicPackage[];
  headingLevel?: 3 | 4;
}) {
  if (packages.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  return (
    <ul className="packages__list">
      {packages.map((pkg, i) => {
        const details = [
          pkg.includes.length > 0 ? { label: "Inclui", value: pkg.includes.join(" · ") } : null,
          pkg.deliverables.length > 0
            ? {
                label: "Entregas",
                value: pkg.deliverables
                  .map((item) => (item.quantity ? `${item.label}: ${item.quantity}` : item.label))
                  .join(" · "),
              }
            : null,
          pkg.recordingDuration ? { label: "Captação", value: pkg.recordingDuration } : null,
          pkg.revisionLimit ? { label: "Revisões", value: pkg.revisionLimit } : null,
          pkg.optionals.length > 0 ? { label: "Opcionais", value: pkg.optionals.join(" · ") } : null,
        ].filter((detail): detail is { label: string; value: string } => detail !== null);
        return (
          <li key={pkg.id} className="packages__row" {...revealProps(i % 3)}>
            <span className="packages__row-n" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <div className="packages__row-main">
              <Title className="packages__row-name">{pkg.name}</Title>
              {pkg.tagline ? <p className="packages__row-for">{pkg.tagline}</p> : null}
              {pkg.description ? <p className="packages__row-text">{pkg.description}</p> : null}
              {details.length > 0 ? (
                <dl className="packages__row-data">
                  {details.map((detail) => (
                    <div key={detail.label}>
                      <dt>{detail.label}</dt>
                      <dd>{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            {/* Sem valor publicado a linha não repete o texto padrão: ele aparece uma vez, na nota da seção. */}
            {hasPublicPrice(pkg) ? (
              <p className="packages__row-price">
                <span className="sr-only">Investimento: </span>
                <PackagePrice pkg={pkg} />
              </p>
            ) : (
              <span className="packages__row-price" />
            )}
            <SiteButtonLink
              href={packageContactHref(pkg)}
              variant="secondary"
              size="sm"
              className="packages__row-cta"
              aria-label={`${pkg.ctaLabel}: ${pkg.name}`}
            >
              {pkg.ctaLabel}
            </SiteButtonLink>
          </li>
        );
      })}
    </ul>
  );
}
