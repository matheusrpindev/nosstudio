/**
 * Microanimação de entrada por rolagem.
 *
 * Como funciona: o servidor só marca o elemento com `data-reveal`. O conteúdo já nasce visível — nada
 * depende de JS para aparecer. No navegador, <RevealObserver /> (montado uma vez pelo <SiteShell>) esconde
 * APENAS o que ainda está abaixo da dobra e revela quando entra na tela. Com `prefers-reduced-motion`,
 * sem IntersectionObserver ou sem JS, tudo fica como veio do servidor.
 */
import type { CSSProperties, ElementType, ReactNode } from "react";

/** Props para espalhar em qualquer elemento: `<li {...revealProps(2)}>`. `delay` é a posição na sequência (× 80ms). */
export function revealProps(delay = 0): { "data-reveal": ""; style?: CSSProperties } {
  return delay > 0 ? { "data-reveal": "", style: { "--d": delay } as CSSProperties } : { "data-reveal": "" };
}

export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
}: {
  as?: ElementType;
  /** Posição na sequência (0, 1, 2…): cada passo atrasa 80ms. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className} {...revealProps(delay)}>
      {children}
    </Tag>
  );
}
