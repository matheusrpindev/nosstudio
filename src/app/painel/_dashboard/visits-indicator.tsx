import { ArrowUpRight, Eye } from "lucide-react";
import Link from "next/link";
import { formatCount } from "@/lib/metrics/report";
import type { VisitSnapshot } from "@/server/metrics/queries";

/**
 * Indicador pequeno de visitas do site (hoje / últimos 7 dias) na visão geral. Só existe para quem vê o módulo
 * Site: para os demais o servidor nem consulta (`page.tsx` passa `null` e isto não é renderizado).
 */
export function VisitsIndicator({ snapshot }: { snapshot: VisitSnapshot }) {
  const empty = snapshot.collectingSince === null;
  return (
    <Link
      href="/painel/site/metricas?periodo=7"
      aria-label={empty ? "Visitas do site: ainda sem dados. Abrir as métricas do site." : `Visitas do site: ${snapshot.today} hoje, ${snapshot.last7} nos últimos 7 dias. Abrir as métricas do site.`}
      className="card group hover:border-detalhe/40 flex min-h-11 flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 transition-colors sm:px-5"
    >
      <span className="text-texto-suave flex items-center gap-2 text-sm font-semibold">
        <Eye aria-hidden="true" className="text-detalhe size-[1.125rem]" />
        Visitas do site
      </span>
      {empty ? (
        <span className="text-texto-suave text-sm">Ainda sem dados — a contagem começa quando alguém abrir o site.</span>
      ) : (
        <>
          <span className="text-texto text-sm">
            <strong className="text-primaria text-lg font-extrabold tabular-nums">{formatCount(snapshot.today)}</strong> hoje
          </span>
          <span className="text-texto text-sm">
            <strong className="text-primaria text-lg font-extrabold tabular-nums">{formatCount(snapshot.last7)}</strong> nos últimos 7 dias
          </span>
        </>
      )}
      <span className="text-detalhe ml-auto flex items-center gap-1 text-sm font-semibold">
        Ver métricas
        <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
