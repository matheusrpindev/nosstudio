import { formatMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import type { MonthPoint } from "@/server/finance/summary";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const axisLabel = (cents: number) => (cents === 0 ? "R$ 0" : `R$ ${compact.format(cents / 100)}`);
const monthName = (month: string) => formatMonth(`${month}-01`);

/** Barra com os cantos de cima arredondados e a base reta (ancorada na linha de base). */
function barPath(x: number, y: number, width: number, height: number, radius = 3): string {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

const W = 360;
const H = 232;
const LEFT = 46;
const RIGHT = 6;
const TOP = 10;
const BOTTOM = 38;

/**
 * Receitas × despesas REALIZADAS nos últimos meses. SVG próprio (sem biblioteca): barras lado a lado, uma legenda
 * e a tabela equivalente (abre em "Ver valores"), que também é o texto para leitores de tela.
 */
export function BalanceChart({ points, selectedMonth }: { points: MonthPoint[]; selectedMonth: string }) {
  const max = Math.max(0, ...points.flatMap((p) => [p.receitasCents, p.despesasCents]));
  if (max === 0) {
    return <p className="text-texto-suave py-6 text-center text-sm">Ainda não há valores recebidos ou pagos nestes meses. Quando você marcar lançamentos como recebidos ou pagos, o gráfico aparece aqui.</p>;
  }
  // topo "redondo" do eixo: 1, 2, 2,5, 5 ou 10 × potência de 10
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const niceMax = ([1, 2, 2.5, 5, 10].find((step) => step * magnitude >= max) ?? 10) * magnitude;
  const ticks = [0, niceMax / 2, niceMax];
  const plotW = W - LEFT - RIGHT;
  const plotH = H - TOP - BOTTOM;
  const group = plotW / points.length;
  const barW = Math.min(18, group / 2 - 4);
  const y = (cents: number) => TOP + plotH - (cents / niceMax) * plotH;
  const summary = `Receitas e despesas realizadas nos últimos ${points.length} meses, de ${monthName(points[0].month)} a ${monthName(points[points.length - 1].month)}. Os valores estão na tabela abaixo.`;

  return (
    <figure className="m-0">
      <ul className="text-texto mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium" aria-label="Legenda">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-roxo inline-block size-3.5 rounded-[3px]" />
          Receitas recebidas
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-lavanda border-detalhe inline-block size-3.5 rounded-[3px] border-[1.5px]" />
          Despesas pagas
        </li>
      </ul>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full max-w-[34rem]">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "stroke-borda-forte" : "stroke-borda"} strokeWidth={1} />
            <text x={LEFT - 6} y={y(tick) + 3.5} textAnchor="end" className="fill-texto-suave" fontSize={10}>
              {axisLabel(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x0 = LEFT + index * group;
          const center = x0 + group / 2;
          const selected = point.month === selectedMonth.slice(0, 7);
          const [yearText, monthNum] = point.month.split("-");
          const showYear = index === 0 || monthNum === "01";
          const income = (point.receitasCents / niceMax) * plotH;
          const expense = (point.despesasCents / niceMax) * plotH;
          return (
            <g key={point.month}>
              {selected ? <rect x={x0 + 2} y={TOP} width={group - 4} height={plotH} rx={4} className="fill-detalhe-suave" /> : null}
              {/* base reta + canto de cima arredondado; 2px de respiro entre as duas barras */}
              {income > 0 ? (
                <path d={barPath(center - barW - 1, y(point.receitasCents), barW, income)} className="fill-detalhe">
                  <title>{`Receitas recebidas em ${monthName(point.month)}: ${formatBRL(point.receitasCents)}`}</title>
                </path>
              ) : null}
              {expense > 0 ? (
                <path d={barPath(center + 1, y(point.despesasCents), barW, expense)} className="fill-lavanda stroke-detalhe" strokeWidth={1.5}>
                  <title>{`Despesas pagas em ${monthName(point.month)}: ${formatBRL(point.despesasCents)}`}</title>
                </path>
              ) : null}
              <text x={center} y={H - BOTTOM + 15} textAnchor="middle" fontSize={11} className={selected ? "fill-detalhe font-bold" : "fill-texto"}>
                {monthName(point.month).slice(0, 3)}
              </text>
              {showYear ? (
                <text x={center} y={H - BOTTOM + 28} textAnchor="middle" fontSize={9} className="fill-texto-suave">
                  {yearText}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <details className="mt-3">
        <summary className="text-detalhe focus-visible:outline-foco inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline-offset-2 hover:underline">Ver valores em tabela</summary>
        <div className="overflow-x-auto">
          <table className="mt-1 w-full text-sm">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr className="text-texto-suave border-borda border-b text-left text-xs uppercase">
                <th scope="col" className="py-2 pr-3 font-semibold">Mês</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Receitas</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Despesas</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-borda divide-y">
              {points.map((point) => (
                <tr key={point.month}>
                  <th scope="row" className="py-2 pr-3 text-left font-medium whitespace-nowrap">{monthName(point.month)}</th>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(point.receitasCents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(point.despesasCents)}</td>
                  <td className={`py-2 pl-3 text-right font-semibold tabular-nums whitespace-nowrap ${point.resultadoCents < 0 ? "text-perigo" : "text-sucesso"}`}>{formatBRL(point.resultadoCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
