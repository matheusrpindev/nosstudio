"use client";

import { useEffect } from "react";

/**
 * Liga as microanimações de entrada (`data-reveal`) da página inteira com um único IntersectionObserver.
 * Montado uma vez pelo <SiteShell>. Não renderiza nada.
 */
export function RevealObserver() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-reveal", "in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    // Só esconde o que ainda não está na tela: o que o visitante já vê nunca pisca.
    const prime = () => {
      const limit = window.innerHeight * 0.96;
      for (const el of document.querySelectorAll('[data-reveal=""]')) {
        if (el.getBoundingClientRect().top > limit) {
          el.setAttribute("data-reveal", "pending");
          io.observe(el);
        } else {
          el.setAttribute("data-reveal", "in");
        }
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
      for (const el of document.querySelectorAll('[data-reveal="pending"]')) el.setAttribute("data-reveal", "in");
    };
  }, []);

  return null;
}
