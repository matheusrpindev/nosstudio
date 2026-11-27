/**
 * Contador público de visitas — "Cada visita é o começo de uma nova história." (briefing v2, seção 11).
 *
 * - O número é o total REAL de visitas medido pelo próprio site (`getPublicVisitCount()`), com a métrica
 *   identificada na legenda ("visitas ao site desde novembro de 2026"). Nada é digitado nem arredondado para cima.
 * - Nasce DESLIGADO: os sócios ligam em Editar site › Textos › Contador de visitas (e podem exigir um mínimo).
 *   Desligado, sem legenda, sem visitas ou abaixo do mínimo, NADA é renderizado (nem a faixa).
 * - Server Component, lido por funções com cache: as páginas continuam estáticas e o número chega pronto no HTML
 *   (sem salto de layout, sem contagem animada). Ele é refeito a cada poucos minutos (perfil de cache `site`).
 *
 * Duas formas de usar:
 *   <VisitCounterView />   só o miolo (frase + número + legenda), dentro de um bloco `data-tone="roxo" | "grafite"` —
 *                          é o que o rodapé interativo (footer-experience.tsx) monta, dono desse espaço;
 *   <VisitCounterBand />   faixa completa acima do rodapé institucional: só quando o rodapé interativo está
 *                          desligado (o próprio <FooterExperience> decide; nunca aparecem os dois).
 */
import { cn } from "@/lib/cn";
import { visitCounterView } from "@/lib/metrics/counter";
import { getPublicVisitCount } from "@/server/metrics/public";
import { getSiteContent } from "@/server/site/queries";
import { revealProps } from "./reveal";
import "./visit-counter.css";

export type VisitCounterContent = NonNullable<ReturnType<typeof visitCounterView>>;

/** O que mostrar agora — ou `null` se o contador não deve aparecer. */
export async function loadVisitCounter(): Promise<VisitCounterContent | null> {
  const [content, data] = await Promise.all([getSiteContent(), getPublicVisitCount()]);
  return visitCounterView(content.visitCounter, data);
}

/** Miolo do contador, sem moldura. Recebe o conteúdo pronto (de `loadVisitCounter`). */
export function VisitCounterView({ counter, className }: { counter: VisitCounterContent; className?: string }) {
  return (
    <div className={cn("s-visits__row", className)}>
      {counter.phrase ? <p className="s-visits__phrase">{counter.phrase}</p> : null}
      <p className="s-visits__count">
        <strong className="s-visits__value">{counter.value}</strong>
        <span className="s-visits__label">{counter.label}</span>
      </p>
    </div>
  );
}

/** Miolo do contador com os dados já buscados. Não renderiza nada quando o contador está oculto. */
export async function VisitCounter({ className }: { className?: string }) {
  const counter = await loadVisitCounter();
  return counter ? <VisitCounterView counter={counter} className={className} /> : null;
}

/** Faixa do contador, logo acima do rodapé institucional. `counter` já buscado evita ler de novo. */
export async function VisitCounterBand({ counter: preloaded }: { counter?: VisitCounterContent | null } = {}) {
  const counter = preloaded === undefined ? await loadVisitCounter() : preloaded;
  if (!counter) return null;
  return (
    <section className="s-visits" id="contador-de-visitas" data-tone="grafite" data-menu-inert aria-label="Contador de visitas do site">
      <div className="s-wrap" {...revealProps()}>
        <VisitCounterView counter={counter} />
      </div>
    </section>
  );
}
