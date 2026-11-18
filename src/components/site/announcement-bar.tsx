"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { InlineScript } from "./inline-script";
import { AccentMark, Icon } from "./marks";

/** Um aviso já pronto para exibir (cores resolvidas e link validado no servidor). */
export type AnnouncementView = {
  id: number;
  /** Muda quando o aviso é editado: um aviso fechado volta a aparecer se o texto mudar. */
  version: number;
  message: string;
  linkLabel: string | null;
  /** Já passado por `safeHref` no servidor ("" = sem link). */
  href: string;
  bg: string;
  fg: string;
  mark: string;
  /** Janela de exibição no horário do estúdio, "YYYY-MM-DDTHH:mm" (nulo = sem limite). */
  startsAt: string | null;
  endsAt: string | null;
  dismissible: boolean;
};

const storageKey = (item: Pick<AnnouncementView, "id" | "version">) => `nos:aviso:${item.id}:${item.version}`;

/** "Agora" no fuso do estúdio, no mesmo formato das janelas ("YYYY-MM-DDTHH:mm"). "" se o navegador não souber. */
function nowInTimezone(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}

/** O primeiro aviso cuja janela inclui o momento atual e que o visitante não fechou. */
function pickVisible(items: AnnouncementView[], timeZone: string): number | null {
  const now = nowInTimezone(timeZone);
  for (const item of items) {
    if (now && item.startsAt && item.startsAt > now) continue;
    if (now && item.endsAt && item.endsAt <= now) continue;
    if (item.dismissible) {
      try {
        if (window.localStorage.getItem(storageKey(item)) === "1") continue;
      } catch {
        /* armazenamento indisponível: mostra o aviso */
      }
    }
    return item.id;
  }
  return null;
}

/**
 * A mesma regra de `pickVisible`, em JS puro, para rodar ANTES da primeira pintura: a página é estática
 * (cache), então o HTML traz todos os avisos candidatos e este script esconde os que não valem agora — sem
 * piscar e sem erro de hidratação. Lê os dados dos atributos `data-*` do próprio HTML.
 */
const PRE_PAINT = `(function(s){var r=s&&s.previousElementSibling;if(!r)return;var n="";try{var p=new Intl.DateTimeFormat("en-CA",{timeZone:r.getAttribute("data-tz"),year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()),g=function(t){for(var i=0;i<p.length;i++)if(p[i].type===t)return p[i].value;return"00"};n=g("year")+"-"+g("month")+"-"+g("day")+"T"+g("hour")+":"+g("minute")}catch(e){}var f=false,c=r.children;for(var i=0;i<c.length;i++){var a=c[i],b=a.getAttribute("data-start"),e=a.getAttribute("data-end"),k=a.getAttribute("data-key"),ok=!f;if(ok&&n&&b&&b>n)ok=false;if(ok&&n&&e&&e<=n)ok=false;if(ok&&k){try{if(localStorage.getItem(k)==="1")ok=false}catch(x){}}a.hidden=!ok;if(ok)f=true}})(document.currentScript)`;

/**
 * Barra de avisos do topo. Mostra um aviso por vez; fechável quando `dismissible` (lembra em localStorage
 * por id + versão). Rola junto com a página — não ocupa espaço fixo no celular.
 */
export function AnnouncementBar({ items, timeZone }: { items: AnnouncementView[]; timeZone: string }) {
  // No servidor: o primeiro aviso. No navegador: a mesma conta que o script inline já aplicou ao HTML.
  const [activeId, setActiveId] = useState<number | null>(() =>
    typeof window === "undefined" ? (items[0]?.id ?? null) : pickVisible(items, timeZone),
  );

  if (items.length === 0) return null;

  function dismiss(item: AnnouncementView) {
    try {
      window.localStorage.setItem(storageKey(item), "1");
    } catch {
      /* sem armazenamento: fecha só nesta visita */
    }
    setActiveId(null);
    document.querySelector<HTMLElement>("[data-site-brand]")?.focus({ preventScroll: true });
  }

  return (
    <>
      <div data-site-notices data-menu-inert data-tz={timeZone}>
        {items.map((item) => (
          <aside
            key={item.id}
            className="s-notice"
            aria-label="Aviso"
            hidden={item.id !== activeId}
            suppressHydrationWarning
            data-start={item.startsAt ?? undefined}
            data-end={item.endsAt ?? undefined}
            data-key={item.dismissible ? storageKey(item) : undefined}
            style={{ "--notice-bg": item.bg, "--notice-fg": item.fg, "--notice-mark": item.mark } as CSSProperties}
          >
            <div className="s-wrap s-notice__in">
              <AccentMark className="s-notice__mark" />
              <p className="s-notice__text">
                {item.message}
                {item.href && item.linkLabel ? (
                  /^https?:/i.test(item.href) ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer">
                      {item.linkLabel}
                    </a>
                  ) : (
                    <Link href={item.href}>{item.linkLabel}</Link>
                  )
                ) : null}
              </p>
              {item.dismissible ? (
                <button type="button" className="s-notice__close" aria-label="Fechar aviso" onClick={() => dismiss(item)}>
                  <Icon name="close" />
                </button>
              ) : null}
            </div>
          </aside>
        ))}
      </div>
      <InlineScript html={PRE_PAINT} />
    </>
  );
}
