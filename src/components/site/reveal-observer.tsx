"use client";

import { useEffect } from "react";

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const RISE: Keyframe[] = [
  { opacity: 0, transform: "translateY(1rem)" },
  { opacity: 1, transform: "none" },
];
const DRAW: Keyframe[] = [{ transform: "scaleX(0)" }, { transform: "none" }];

/**
 * Liga as microanimações de entrada (`data-reveal`) da página inteira com um único IntersectionObserver.
 * Montado uma vez pelo <SiteShell>. Não renderiza nada.
 *
 * Usa a Web Animations API em vez de trocar classes/atributos: assim o DOM que o React hidrata nunca é
 * alterado (sem aviso de hidratação) e, se este script não rodar, tudo simplesmente fica visível.
 */
export function RevealObserver() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const seen = new WeakSet<Element>();
    const waiting = new Map<Element, Animation>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          const animation = waiting.get(entry.target);
          waiting.delete(entry.target);
          if (!animation) continue;
          animation.onfinish = () => animation.cancel(); // devolve o elemento ao estado natural
          animation.play();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    // Só prepara (pausado no primeiro quadro) o que ainda está abaixo da dobra: o que já está na tela nunca pisca.
    const prime = () => {
      const limit = window.innerHeight * 0.96;
      for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.getBoundingClientRect().top <= limit) continue;
        const step = Number(getComputedStyle(el).getPropertyValue("--d")) || 0;
        const line = el.classList.contains("s-rule");
        const animation = el.animate(line ? DRAW : RISE, {
          duration: line ? 1000 : 700,
          delay: step * 80,
          easing: EASE,
          fill: "both",
        });
        animation.pause();
        waiting.set(el, animation);
        io.observe(el);
      }
    };
    prime();

    // Navegação entre páginas e conteúdo que chega depois (streaming) trazem novos elementos.
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(prime);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
      for (const animation of waiting.values()) animation.cancel();
      waiting.clear();
    };
  }, []);

  return null;
}
