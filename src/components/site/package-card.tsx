/**
 * Cartões de pacote (planos mensais e serviços avulsos).
 *
 * Regras dos sócios aplicadas aqui:
 * - preço conforme `priceMode` — valor oculto por padrão (no lugar entra o texto de
 *   `packagesPage.priceOnRequestLabel`); o valor só aparece em "a partir de" / "fixo";
 * - plano com plano-base mostra "Tudo do <base>, mais:" antes das entregas próprias;
 * - quantidades (`deliverables`), duração de captação e limite de revisões só aparecem quando preenchidos;
 * - o plano recomendado ganha o bloco roxo e a etiqueta lima.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { PRICE_MODE_LABELS } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import type { PublicPackage } from "@/server/site/queries";
import { SiteButtonLink } from "./button";
import { LevelMark } from "./marks";
import { revealProps } from "./reveal";
import { packageContactHref } from "./text";

/** O pacote tem valor publicado? (Sem valor, o site mostra o texto de `priceOnRequestLabel`.) */
export function hasPublicPrice(pkg: Pick<PublicPackage, "priceMode" | "priceCents">): boolean {
  return pkg.priceMode !== "sob_consulta" && pkg.priceCents != null;
}

/**
 * Preço público de um pacote, já no formato de exibição. Sem valor publicado, mostra `onRequestLabel`
 * ("Investimento personalizado para o seu negócio.") — e nada, se o texto estiver vazio.
 */
export function PackagePrice({
  pkg,
  onRequestLabel = "",
}: {
  pkg: Pick<PublicPackage, "priceMode" | "priceCents" | "priceSuffix" | "discountNote">;
  onRequestLabel?: string;
}) {
  if (!hasPublicPrice(pkg) || pkg.priceCents == null) return <span className="s-price__text">{onRequestLabel}</span>;
  return (
    <>
      {pkg.priceMode === "a_partir" ? <small>{PRICE_MODE_LABELS.a_partir} </small> : null}
      {formatBRL(pkg.priceCents)}
      {pkg.priceSuffix ? <small> {pkg.priceSuffix}</small> : null}
      {pkg.discountNote ? <span className="s-price__note">{pkg.discountNote}</span> : null}
    </>
  );
}

type PackageCardProps = {
  pkg: PublicPackage;
  /** Posição do plano na escada (acende os acentos do indicador). Omitir = sem indicador. */
  level?: { index: number; total: number };
  /** Texto da etiqueta do recomendado (content.packagesPage.recommendedLabel). */
  recommendedLabel?: string;
  /** Texto no lugar do valor não publicado (content.packagesPage.priceOnRequestLabel). */
  priceOnRequestLabel?: string;
  /** "summary" (home): posicionamento + preço. "full" (/pacotes): também o que inclui, captação e revisões. */
  detail?: "summary" | "full";
  /** Cartão menor, para serviços avulsos. */
  compact?: boolean;
  /** Destino do botão. Padrão: /contato com o pacote pré-selecionado. `null` esconde o botão. */
  href?: string | null;
  headingLevel?: 3 | 4;
  delay?: number;
};

export function PackageCard({
  pkg,
  level,
  recommendedLabel,
  priceOnRequestLabel = "",
  detail = "summary",
  compact = false,
  href,
  headingLevel = 3,
  delay = 0,
}: PackageCardProps) {
  const Title = `h${headingLevel}` as "h3" | "h4";
  const recommended = pkg.recommended && !compact;
  const target = href === undefined ? packageContactHref(pkg) : href;
  const full = detail === "full";
  return (
    <li
      className={cn("s-plan", recommended && "s-plan--rec", compact && "s-plan--compact")}
      data-tone={recommended ? "roxo" : undefined}
      {...revealProps(delay)}
    >
      {compact ? null : (
        <div className="s-plan__top">
          {level ? <LevelMark level={level.index + 1} total={level.total} /> : <span />}
          {recommended && recommendedLabel ? <span className="s-tag">{recommendedLabel}</span> : null}
        </div>
      )}
      <Title className="s-plan__name">{pkg.name}</Title>
      {/* no quadro de planos a linha existe mesmo vazia: mantém os cartões alinhados entre si */}
      {compact && !pkg.tagline ? null : <p className="s-plan__for">{pkg.tagline}</p>}
      <dl className="s-plan__data">
        {pkg.description ? (
          <div>
            <dt className="sr-only">Sobre</dt>
            <dd>{pkg.description}</dd>
          </div>
        ) : null}
        {full && (pkg.includes.length > 0 || pkg.base) ? (
          <div>
            <dt>Inclui</dt>
            <dd>
              {pkg.base ? <p className="s-plan__base">Tudo do {pkg.base.name}, mais:</p> : null}
              <ul>
                {pkg.includes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {pkg.deliverables.length > 0 ? (
          <div>
            <dt>Entregas</dt>
            <dd>
              <ul>
                {pkg.deliverables.map((item, i) => (
                  <li key={i} className="s-plan__qty">
                    <span>{item.label}</span>
                    {item.quantity ? <b>{item.quantity}</b> : null}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {full && pkg.recordingDuration ? (
          <div>
            <dt>Captação</dt>
            <dd>{pkg.recordingDuration}</dd>
          </div>
        ) : null}
        {full && pkg.revisionLimit ? (
          <div>
            <dt>Revisões</dt>
            <dd>{pkg.revisionLimit}</dd>
          </div>
        ) : null}
        {full && pkg.optionals.length > 0 ? (
          <div>
            <dt>Opcionais</dt>
            <dd>
              <ul>
                {pkg.optionals.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {hasPublicPrice(pkg) || priceOnRequestLabel ? (
          <div className="s-plan__price">
            <dt>Investimento</dt>
            <dd>
              <PackagePrice pkg={pkg} onRequestLabel={priceOnRequestLabel} />
            </dd>
          </div>
        ) : null}
      </dl>
      {target ? (
        <SiteButtonLink
          href={target}
          variant={recommended ? "primary" : "secondary"}
          aria-label={`${pkg.ctaLabel}: ${pkg.name}`}
        >
          {pkg.ctaLabel}
        </SiteButtonLink>
      ) : compact ? null : (
        <span />
      )}
    </li>
  );
}

/**
 * Conjunto de pacotes. Até 3 planos formam um quadro contínuo (o recomendado "fura" o quadro); com mais
 * itens — ou com `compact` — vira uma grade de cartões.
 */
export function PackageBoard({
  packages,
  recommendedLabel,
  priceOnRequestLabel,
  detail,
  compact = false,
  showLevels = true,
  hrefFor,
  headingLevel,
  className,
}: {
  packages: PublicPackage[];
  recommendedLabel?: string;
  priceOnRequestLabel?: string;
  detail?: "summary" | "full";
  compact?: boolean;
  /** Mostra o indicador de nível (1 de 3, 2 de 3…) — faz sentido para planos em escada. */
  showLevels?: boolean;
  /** Destino do botão de cada pacote. Padrão: /contato com o pacote pré-selecionado. */
  hrefFor?: (pkg: PublicPackage) => string | null;
  headingLevel?: 3 | 4;
  className?: string;
}) {
  if (packages.length === 0) return null;
  const board = !compact && packages.length <= 3;
  return (
    <ul
      className={cn("s-plans", className)}
      data-layout={board ? "board" : "grid"}
      style={{ "--cols": packages.length } as CSSProperties}
    >
      {packages.map((pkg, i) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          level={showLevels && !compact && packages.length <= 6 ? { index: i, total: packages.length } : undefined}
          recommendedLabel={recommendedLabel}
          priceOnRequestLabel={priceOnRequestLabel}
          detail={detail}
          compact={compact}
          href={hrefFor ? hrefFor(pkg) : undefined}
          headingLevel={headingLevel}
          delay={i % 3}
        />
      ))}
    </ul>
  );
}
