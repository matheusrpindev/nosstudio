"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Coletor da medição de visitas do site (montado uma vez pelo <SiteShell>). Não renderiza nada, não grava cookie
 * nem usa armazenamento do navegador — só envia um sinal mínimo para `POST /api/visita`:
 *
 * - PÁGINA VISTA: a cada troca de página, o caminho; na primeira página, também o DOMÍNIO de onde a pessoa veio
 *   (nunca a URL inteira), a largura da tela e as marcações de campanha (utm_*). Só depois que a página está de
 *   fato visível (não conta pré-carregamento nem aba aberta em segundo plano que ninguém olhou).
 * - CLIQUE MEDIDO: um único listener no documento. Conta o clique em qualquer elemento com
 *   `data-track="<tipo>:<alvo>"` — contrato: `whatsapp:<onde>` (ex.: `whatsapp:flutuante`) e `banner:<id>` — e,
 *   como rede de segurança, em links de WhatsApp sem marcação (`whatsapp:link`).
 *
 * Quem decide o que conta é o servidor (robôs, painel, limite por IP…): ver `src/app/api/visita/route.ts`.
 * O envio usa `sendBeacon` (não bloqueia a navegação) e qualquer falha é ignorada: a página nunca depende disto.
 */
const ENDPOINT = "/api/visita";
const WHATSAPP_LINK = /^https:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\//i;

type Signal = { t: "p" | "e"; p: string; r?: string; w?: number; us?: string; um?: string; uc?: string; e?: string };

/** Só a primeira página de cada carregamento leva referência e campanha (as seguintes são navegação interna). */
let landed = false;

function send(signal: Signal) {
  try {
    const body = JSON.stringify(signal);
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, body)) return;
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true, credentials: "same-origin", headers: { "Content-Type": "text/plain;charset=UTF-8" } }).catch(() => undefined);
  } catch {
    // a medição nunca atrapalha a página
  }
}

/** Domínio de onde a pessoa veio (vazio para acesso direto ou navegação dentro do próprio site). */
function referrerHost(): string {
  try {
    if (!document.referrer) return "";
    const url = new URL(document.referrer);
    return url.host === window.location.host ? "" : url.hostname.slice(0, 120);
  } catch {
    return "";
  }
}

function landingSignal(path: string): Signal {
  const signal: Signal = { t: "p", p: path };
  const host = referrerHost();
  if (host) signal.r = host;
  const width = Math.round(window.screen?.width ?? 0);
  if (width > 0 && width <= 20_000) signal.w = width;
  const params = new URLSearchParams(window.location.search);
  for (const [key, name] of [
    ["us", "utm_source"],
    ["um", "utm_medium"],
    ["uc", "utm_campaign"],
  ] as const) {
    const value = params.get(name)?.trim().slice(0, 120);
    if (value) signal[key] = value;
  }
  return signal;
}

/** Roda `run` quando a página estiver ativada (fora do pré-carregamento) e visível. Devolve como cancelar. */
function whenSeen(run: () => void): () => void {
  let cancelled = false;
  const doc = document as Document & { prerendering?: boolean };
  const attempt = () => {
    if (cancelled) return;
    if (doc.prerendering) {
      document.addEventListener("prerenderingchange", attempt, { once: true });
      return;
    }
    if (document.visibilityState !== "visible") {
      document.addEventListener("visibilitychange", attempt, { once: true });
      return;
    }
    run();
  };
  attempt();
  return () => {
    cancelled = true;
    document.removeEventListener("prerenderingchange", attempt);
    document.removeEventListener("visibilitychange", attempt);
  };
}

function Tracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  // páginas vistas
  useEffect(() => {
    // navegador controlado por automação (testes, robôs de captura) não é visita
    if (!pathname || navigator.webdriver) return;
    if (lastPath.current === pathname) return;
    return whenSeen(() => {
      if (lastPath.current === pathname) return;
      lastPath.current = pathname;
      send(landed ? { t: "p", p: pathname } : landingSignal(pathname));
      landed = true;
    });
  }, [pathname]);

  // cliques medidos (um listener para a página inteira)
  useEffect(() => {
    if (navigator.webdriver) return;
    let lastKey = "";
    let lastAt = 0;
    const onClick = (event: MouseEvent) => {
      // clique principal ou do meio (abrir em nova aba)
      if (event.button > 1 || !(event.target instanceof Element)) return;
      const marked = event.target.closest<HTMLElement>("[data-track]");
      let key = marked?.dataset.track?.trim() ?? "";
      if (!key) {
        const link = event.target.closest<HTMLAnchorElement>("a[href]");
        if (link && WHATSAPP_LINK.test(link.href)) key = "whatsapp:link";
      }
      if (!/^[a-z]{2,20}:[a-z0-9][a-z0-9_-]{0,39}$/.test(key)) return;
      // dois eventos do mesmo toque (ou clique duplo) contam uma vez
      const now = performance.now();
      if (key === lastKey && now - lastAt < 1000) return;
      lastKey = key;
      lastAt = now;
      send({ t: "e", p: window.location.pathname, e: key });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return null;
}

/** `usePathname` pode suspender em rotas com parâmetro dinâmico: sem fallback visível (o coletor não renderiza nada). */
export function VisitTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
