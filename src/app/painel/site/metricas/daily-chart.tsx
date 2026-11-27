"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatDate, formatDateShort, formatWeekday } from "@/lib/dates";
import { formatCount, type DayPoint } from "@/lib/metrics/report";

/**
 * Visitas e visitantes estimados por dia. SVG próprio (sem biblioteca): duas linhas na MESMA escala, legenda,
 * leitura por dia (numa linha acima do desenho) ao passar o mouse, tocar ou usar as setas do teclado, e a tabela equivalente ("Ver valores em
 * tabela"), que também é o texto para leitores de tela. Cores: só tokens do tema (lima = visitas; roxo claro =
 * visitantes); a identidade não depende só da cor — há legenda, rótulo no fim de cada linha e a tabela.
 */
const H = 240;
const LEFT = 44;
const RIGHT = 16;
const TOP = 16;
const BOTTOM = 34;
const PLOT_H = H - TOP - BOTTOM;
/** Largura usada até o navegador medir o espaço disponível. */
const DEFAULT_W = 720;

/** Topo "redondo" do eixo (1, 2, 2,5, 5 ou 10 × potência de 10), nunca menor que 4 para o eixo ter marcas inteiras. */
function niceMax(max: number): number {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 2.5, 5, 10].find((step) => step * magnitude >= max) ?? 10) * magnitude;
}

/** Poucas datas no eixo (menos ainda em tela estreita), sempre com a primeira e a última. */
function tickIndexes(count: number, width: number): number[] {
  const steps = width < 480 ? 3 : width < 640 ? 4 : 6;
  if (count <= steps + 1) return Array.from({ length: count }, (_, index) => index);
  return [...new Set(Array.from({ length: steps + 1 }, (_, index) => Math.round((index * (count - 1)) / steps)))];
}

/**
 * `todayPartial`: o último dia do período é hoje e ainda está em andamento — o trecho até ele sai tracejado e
 * apagado, para a queda do fim da linha não parecer uma queda de verdade.
 */
export function DailyChart({ days, todayPartial = false }: { days: DayPoint[]; todayPartial?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // O desenho usa a largura REAL em pixels (1 unidade = 1 px): os textos do eixo não encolhem no celular.
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setWidth(Math.max(260, Math.round(box.clientWidth)));
    if (!("ResizeObserver" in window)) {
      const frame = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(frame);
    }
    // o observador já avisa uma primeira vez ao começar a observar
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const W = width ?? DEFAULT_W;
  const PLOT_W = W - LEFT - RIGHT;
  const tipId = useId();
  const count = days.length;
  const top = niceMax(Math.max(0, ...days.flatMap((day) => [day.visits, day.visitors])));
  const x = (index: number) => (count === 1 ? LEFT + PLOT_W / 2 : LEFT + (index / (count - 1)) * PLOT_W);
  const y = (value: number) => TOP + PLOT_H - (value / top) * PLOT_H;
  // com o dia de hoje em andamento, a linha cheia vai até ontem e o último trecho é desenhado à parte
  const partial = todayPartial && count > 1;
  const solidEnd = partial ? count - 2 : count - 1;
  const line = (pick: (day: DayPoint) => number) =>
    days
      .slice(0, solidEnd + 1)
      .map((day, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(pick(day)).toFixed(1)}`)
      .join(" ");
  const tail = (pick: (day: DayPoint) => number) => `M${x(solidEnd).toFixed(1)},${y(pick(days[solidEnd])).toFixed(1)} L${x(count - 1).toFixed(1)},${y(pick(days[count - 1])).toFixed(1)}`;
  const visitsPath = line((day) => day.visits);
  const visitorsPath = line((day) => day.visitors);
  const areaPath = solidEnd > 0 ? `${visitsPath} L${x(solidEnd).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const ticks = [0, top / 2, top];
  const last = days[count - 1];
  const summary = `Visitas e visitantes estimados por dia, de ${formatDate(days[0].day)} a ${formatDate(last.day)}. Os valores de cada dia estão na tabela abaixo.`;

  const indexAt = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || count === 1) return 0;
    const px = ((clientX - box.left) / box.width) * W;
    return Math.min(count - 1, Math.max(0, Math.round(((px - LEFT) / PLOT_W) * (count - 1))));
  };
  const onPointer = (event: PointerEvent<SVGSVGElement>) => setActive(indexAt(event.clientX));
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? count - 1;
    const next = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: count - 1 }[event.key];
    if (event.key === "Escape") return setActive(null);
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.min(count - 1, Math.max(0, next)));
  };

  const point = active === null ? null : days[active];
  // rótulos no fim das linhas: afastados quando as duas terminam no mesmo ponto
  const endGap = Math.abs(y(last.visits) - y(last.visitors)) < 12;

  return (
    <figure className="m-0">
      <ul className="text-texto mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium" aria-label="Legenda">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-primaria inline-block h-0.5 w-5 rounded-full" />
          Visitas
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-detalhe inline-block h-0.5 w-5 rounded-full" />
          Visitantes estimados
        </li>
        {partial ? (
          <li className="text-texto-suave flex items-center gap-2">
            <span aria-hidden="true" className="border-texto-suave inline-block w-5 border-t-2 border-dashed" />
            Hoje (dia em andamento)
          </li>
        ) : null}
      </ul>

      {/* Leitura do dia apontado: fica ACIMA do desenho (não cobre as linhas) e tem altura reservada (nada pula). */}
      <div id={tipId} role="status" className="text-texto mb-2 flex min-h-[4.25rem] flex-wrap content-start items-baseline gap-x-4 gap-y-0.5 text-sm sm:min-h-[2.75rem]">
        {point ? (
          <>
            <span className="text-texto w-full font-bold first-letter:uppercase sm:w-auto">
              {formatWeekday(point.day, true)}, {formatDate(point.day)}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="bg-primaria inline-block h-0.5 w-3 rounded-full" />
              <strong className="tabular-nums">{formatCount(point.visits)}</strong> {point.visits === 1 ? "visita" : "visitas"}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="bg-detalhe inline-block h-0.5 w-3 rounded-full" />
              <strong className="tabular-nums">{formatCount(point.visitors)}</strong> {point.visitors === 1 ? "visitante estimado" : "visitantes estimados"}
            </span>
            <span className="text-texto-suave">
              {formatCount(point.pageviews)} {point.pageviews === 1 ? "página vista" : "páginas vistas"}
              {point.forms > 0 ? ` · ${formatCount(point.forms)} ${point.forms === 1 ? "formulário" : "formulários"}` : ""}
            </span>
          </>
        ) : (
          <span className="text-texto-suave">Passe o mouse, toque no gráfico ou use as setas do teclado para ler cada dia.</span>
        )}
      </div>

      <div
        ref={boxRef}
        className="focus-visible:outline-foco relative rounded-md outline-offset-4"
        style={{ height: H }}
        tabIndex={0}
        role="group"
        aria-label="Gráfico de visitas por dia. Use as setas para a esquerda e para a direita para ler cada dia."
        aria-describedby={point ? tipId : undefined}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          width={W}
          height={H}
          // até a largura ser medida o desenho fica invisível (a altura já está reservada: nada pula)
          className={width === null ? "invisible block w-full touch-pan-y" : "block w-full touch-pan-y"}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          // no toque, a leitura fica na tela até tocar fora (o `blur` do grupo limpa); com mouse, some ao sair
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setActive(null);
          }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={LEFT} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "stroke-borda-forte" : "stroke-borda"} strokeWidth={1} />
              <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end" className="fill-texto-suave tabular-nums" fontSize={11}>
                {formatCount(tick)}
              </text>
            </g>
          ))}
          {tickIndexes(count, W).map((index) => (
            <text key={index} x={x(index)} y={H - BOTTOM + 20} textAnchor={count > 1 && index === 0 ? "start" : count > 1 && index === count - 1 ? "end" : "middle"} className="fill-texto-suave" fontSize={11}>
              {formatDateShort(days[index].day)}
            </text>
          ))}

          {areaPath ? <path d={areaPath} className="fill-primaria/10" /> : null}
          <path d={visitorsPath} fill="none" className="stroke-detalhe" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={visitsPath} fill="none" className="stroke-primaria" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {partial ? (
            <g fill="none" strokeWidth={2} strokeLinecap="round" strokeDasharray="1 6" opacity={0.7}>
              <path d={tail((day) => day.visitors)} className="stroke-detalhe" />
              <path d={tail((day) => day.visits)} className="stroke-primaria" />
            </g>
          ) : null}
          {/* ponto no fim de cada linha (ou o único ponto, quando o período tem um dia) */}
          <circle cx={x(count - 1)} cy={y(last.visitors)} r={4} className="fill-detalhe stroke-superficie" strokeWidth={2} />
          <circle cx={x(count - 1)} cy={y(last.visits)} r={4} className="fill-primaria stroke-superficie" strokeWidth={2} />
          {active === null && count > 1 ? (
            <>
              <text x={x(count - 1) - 8} y={y(last.visits) - 8} textAnchor="end" className="fill-texto font-bold tabular-nums" fontSize={12}>
                {partial ? `hoje, até agora: ${formatCount(last.visits)}` : formatCount(last.visits)}
              </text>
              {last.visitors !== last.visits && !partial ? (
                <text x={x(count - 1) - 8} y={y(last.visitors) + (endGap ? 18 : -8)} textAnchor="end" className="fill-texto-suave tabular-nums" fontSize={12}>
                  {formatCount(last.visitors)}
                </text>
              ) : null}
            </>
          ) : null}

          {point && active !== null ? (
            <g>
              <line x1={x(active)} x2={x(active)} y1={TOP} y2={TOP + PLOT_H} className="stroke-borda-forte" strokeWidth={1} />
              <circle cx={x(active)} cy={y(point.visitors)} r={4.5} className="fill-detalhe stroke-superficie" strokeWidth={2} />
              <circle cx={x(active)} cy={y(point.visits)} r={4.5} className="fill-primaria stroke-superficie" strokeWidth={2} />
            </g>
          ) : null}
        </svg>

      </div>

      <details className="mt-2">
        <summary className="text-detalhe focus-visible:outline-foco inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline-offset-2 hover:underline">Ver valores em tabela</summary>
        <div className="max-h-96 overflow-auto">
          <table className="mt-1 w-full text-sm">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr className="text-texto-suave border-borda border-b text-left text-xs uppercase">
                <th scope="col" className="py-2 pr-3 font-semibold">Dia</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Visitas</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Visitantes estimados</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">Páginas vistas</th>
              </tr>
            </thead>
            <tbody className="divide-borda divide-y">
              {days.map((day) => (
                <tr key={day.day}>
                  <th scope="row" className="py-2 pr-3 text-left font-medium whitespace-nowrap">{formatDate(day.day)}</th>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(day.visits)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(day.visitors)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{formatCount(day.pageviews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
