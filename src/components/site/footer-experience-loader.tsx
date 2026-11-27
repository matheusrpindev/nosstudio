"use client";

/**
 * Carregador do rodapé interativo. O HTML (câmera, celular, botões) vem pronto do servidor; este componente
 * minúsculo só espera a seção chegar perto da tela (IntersectionObserver) para baixar o motor
 * (footer-experience-engine.ts) — quem nunca rola até o fim da página não baixa nada.
 * Um clique que chegue antes do motor (conexão lenta) não se perde: a ação é repetida assim que ele monta.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { FooterEngineData } from "./footer-experience-engine";

export function FooterExperienceLoader({ data, className, children }: { data: FooterEngineData; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    let loading = false;
    let unmount: (() => void) | null = null;
    let pending: string | null = null;

    const load = () => {
      if (loading) return;
      loading = true;
      import("./footer-experience-engine")
        .then(({ mountFooterExperience }) => {
          if (cancelled) return;
          unmount = mountFooterExperience(root, data, pending);
          pending = null;
        })
        .catch(() => {
          loading = false; // falhou (rede): tenta de novo no próximo clique
        });
    };

    const onEarlyClick = (event: MouseEvent) => {
      if (unmount) return;
      const action = (event.target as Element | null)?.closest?.("[data-fx-action]")?.getAttribute("data-fx-action");
      if (!action) return;
      pending = action;
      load();
    };
    root.addEventListener("click", onEarlyClick);

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          load();
        },
        { rootMargin: "320px 0px" },
      );
      observer.observe(root);
    } else {
      load();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      root.removeEventListener("click", onEarlyClick);
      unmount?.();
    };
  }, [data]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
