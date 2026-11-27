/**
 * Tabela comparativa dos planos: entregas nas linhas, planos nas colunas. Montada por `buildPlanComparison`
 * a partir do "Inclui" de cada plano (com herança do plano-base). No celular a tabela rola na horizontal dentro
 * de uma região com foco (a primeira coluna fica fixa). Server Component.
 */
import { cn } from "@/lib/cn";
import { buildPlanComparison } from "@/lib/site/plans";
import type { PublicPackage } from "@/server/site/queries";
import { SiteButtonLink } from "./button";
import { Icon } from "./marks";
import { hasPublicPrice, PackagePrice } from "./package-card";
import { packageContactHref } from "./text";

export function PlanComparison({
  plans,
  caption,
  recommendedLabel,
  priceOnRequestLabel = "",
  className,
}: {
  plans: PublicPackage[];
  /** Título da tabela (lido por leitores de tela; o título visível fica no cabeçalho da seção). */
  caption: string;
  recommendedLabel?: string;
  priceOnRequestLabel?: string;
  className?: string;
}) {
  const table = buildPlanComparison(plans);
  if (plans.length < 2 || table.rows.length === 0) return null;
  const showPrice = plans.some(hasPublicPrice);
  return (
    <>
    {/* só no celular, onde a tabela rola na horizontal */}
    <p className="s-compare__hint s-meta" aria-hidden="true">
      Deslize para o lado para ver todos os planos <Icon name="arrow" />
    </p>
    {/* região rolável com foco (teclado). O nome difere do da seção ("Compare os planos") para os marcos não repetirem. */}
    <div className={cn("s-compare", className)} role="region" aria-label={`Tabela: ${caption}`} tabIndex={0}>
      <table className="s-compare__table" style={{ ["--cols" as string]: plans.length }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <td />
            {plans.map((plan) => (
              <th key={plan.id} scope="col" data-rec={plan.recommended || undefined}>
                {plan.recommended && recommendedLabel ? <span className="s-tag s-compare__tag">{recommendedLabel}</span> : null}
                <span className="s-compare__plan">{plan.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.cells.map((included, i) => (
                <td key={plans[i].id} data-rec={plans[i].recommended || undefined} data-on={included || undefined}>
                  {included ? <Icon name="check" className="s-compare__check" /> : <span className="s-compare__dash" aria-hidden="true" />}
                  <span className="sr-only">{included ? "Incluído" : "Não listado"}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {showPrice ? (
            <tr>
              <th scope="row">Investimento</th>
              {plans.map((plan) => (
                <td key={plan.id} data-rec={plan.recommended || undefined} className="s-compare__price">
                  <PackagePrice pkg={plan} onRequestLabel={priceOnRequestLabel} />
                </td>
              ))}
            </tr>
          ) : null}
          <tr className="s-compare__actions">
            <td />
            {plans.map((plan) => (
              <td key={plan.id} data-rec={plan.recommended || undefined} className="s-compare__cta">
                <SiteButtonLink
                  href={packageContactHref(plan)}
                  variant={plan.recommended ? "primary" : "secondary"}
                  size="sm"
                  icon={null}
                  block
                  aria-label={`${plan.ctaLabel}: ${plan.name}`}
                >
                  {plan.ctaLabel}
                </SiteButtonLink>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
}
