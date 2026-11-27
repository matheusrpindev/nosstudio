"use client";

/**
 * Carrossel de banners da página inicial. Segue o padrão "carousel" (auto-rotating) do guia WAI-ARIA APG:
 * - região rotulada com `aria-roledescription="carousel"`; cada banner é um grupo "slide" rotulado "N de M";
 * - o botão de pausa é o PRIMEIRO controle na ordem do teclado (o HTML traz a barra de controles antes dos
 *   banners; o CSS a mostra embaixo) e está sempre visível;
 * - a troca automática para quando o mouse passa por cima ou o foco do teclado entra no carrossel, e `aria-live` fica
 *   desligado enquanto ela está ligada (ligado = leitores de tela anunciam o banner trocado à mão);
 * - com `prefers-reduced-motion`, não avança sozinho (o visitante pode ligar no botão) e a troca é sem animação;
 * - setas (botões e teclas ← →, Home/End), indicadores e arrastar com o dedo. Cada banner tem a sua duração.
 *
 * Os banners chegam prontos do servidor (`slides[].content`, um <BannerSlide> cada): este componente só decide
 * qual está em tela. Banner fora de tela fica `inert` (fora do teclado e dos leitores de tela).
 * Um banner só = sem controles e sem papel de carrossel.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { BannerSlideContext } from "./banner-context";
import { Icon } from "./marks";
import { pad2 } from "./text";

export type CarouselSlide = {
  id: number;
  /** Tempo em tela, em segundos. */
  durationSeconds: number;
  /** Fim da janela de exibição no horário do estúdio (`YYYY-MM-DDTHH:mm`) — conferido de novo aqui no navegador. */
  endsAt: string | null;
  content: ReactNode;
};

// ---------------------------------------------------------------- relógio e preferências
/** "Agora" no fuso do estúdio, no formato das janelas ("YYYY-MM-DDTHH:mm"). "" se o navegador não souber. */
function nowInTimezone(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}
function subscribeMinute(notify: () => void) {
  const timer = window.setInterval(notify, 30_000);
  return () => window.clearInterval(timer);
}

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeMotion(notify: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

function subscribeVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

/** Distância mínima (px) para um arrasto virar troca de banner. */
const SWIPE_MIN = 44;

function PauseIcon({ paused }: { paused: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paused ? <path fill="currentColor" d="M7 4.5 19.5 12 7 19.5z" /> : <path fill="currentColor" d="M6 5h4.5v14H6zM13.5 5H18v14h-4.5z" />}
    </svg>
  );
}

export function BannerCarousel({
  slides: allSlides,
  heading,
  label = "Destaques",
  timeZone,
}: {
  slides: CarouselSlide[];
  /** O <h1> da página (fica dentro da região, antes dos banners). */
  heading?: ReactNode;
  /** Nome da região para leitores de tela. */
  label?: string;
  /** Fuso do estúdio, para conferir o fim da janela de cada banner. */
  timeZone: string;
}) {
  const uid = useId();
  const stageId = `${uid}-banners`;

  // A página é estática e pode ter alguns minutos: um banner cujo período terminou nesse meio-tempo sai daqui.
  // (Se todos tiverem terminado, fica como veio do servidor — a próxima visita já recebe a página nova.)
  const now = useSyncExternalStore(
    subscribeMinute,
    () => nowInTimezone(timeZone),
    () => "",
  );
  const slides = useMemo(() => {
    if (!now) return allSlides;
    const open = allSlides.filter((slide) => !slide.endsAt || slide.endsAt > now);
    return open.length > 0 ? open : allSlides;
  }, [allSlides, now]);
  const count = slides.length;

  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );

  const [position, setPosition] = useState(0);
  const index = Math.min(position, count - 1);
  /** Escolha do visitante no botão de pausa (`null` = ainda não mexeu: vale o padrão). */
  const [choice, setChoice] = useState<boolean | null>(null);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** Banners cuja imagem já pode carregar (os que já apareceram e o próximo). */
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());

  const multiple = count > 1;
  /** A troca automática está LIGADA (mesmo que suspensa agora por mouse/foco)? É o que o botão de pausa mostra. */
  const rotating = multiple && (choice ?? !reducedMotion);
  const running = rotating && !hovering && !focused && !dragging && pageVisible;

  const go = useCallback(
    (to: number) => {
      setPosition(((to % count) + count) % count);
    },
    [count],
  );

  // ---- temporizador: cada banner fica o seu tempo; pausar guarda o que faltava e retomar continua dali
  const left = useRef<{ id: number; ms: number } | null>(null);
  const current = slides[index];
  const duration = Math.max(1, current?.durationSeconds ?? 7) * 1000;
  useEffect(() => {
    if (!running || !current) return;
    const remaining = left.current?.id === current.id ? left.current.ms : duration;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      left.current = null;
      setPosition((value) => (Math.min(value, count - 1) + 1) % count);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      left.current = { id: current.id, ms: Math.max(400, remaining - (performance.now() - started)) };
    };
  }, [running, current, duration, count]);

  // ---- carrega a imagem do próximo banner um pouco antes de ele entrar
  const nextId = multiple ? slides[(index + 1) % count]?.id : undefined;
  const currentId = current?.id;
  useEffect(() => {
    if (currentId === undefined) return;
    const timer = window.setTimeout(() => {
      setSeen((previous) => {
        if (previous.has(currentId) && (nextId === undefined || previous.has(nextId))) return previous;
        const next = new Set(previous);
        next.add(currentId);
        if (nextId !== undefined) next.add(nextId);
        return next;
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [currentId, nextId]);

  // ---- arrastar (toque e caneta). O arrasto vertical continua rolando a página (`touch-action: pan-y`).
  const drag = useRef<{ pointer: number; x: number; y: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // todo toque/clique novo começa limpo: só o clique gerado pelo PRÓPRIO arrasto é engolido
    swallowClick.current = false;
    if (!multiple || event.pointerType === "mouse" || !event.isPrimary) return;
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.moved && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      state.moved = true;
      setDragging(true);
    }
  }
  function endDrag(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    drag.current = null;
    if (state.moved) setDragging(false);
    const dx = event.clientX - state.x;
    if (cancelled || !state.moved || Math.abs(dx) < SWIPE_MIN) return;
    swallowClick.current = true; // o toque que arrastou não pode "clicar" no botão do banner
    left.current = null;
    go(index + (dx < 0 ? 1 : -1));
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!multiple || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable]")) return;
    const to = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
    if (to === null) return;
    event.preventDefault();
    left.current = null;
    go(to);
  }

  function jump(to: number) {
    left.current = null;
    go(to);
  }

  const stage = (
    <div
      className="s-banners__stage"
      id={stageId}
      aria-live={multiple ? (rotating ? "off" : "polite") : undefined}
      aria-atomic={multiple ? "false" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.id}
            className="s-banners__slide"
            role={multiple ? "group" : undefined}
            aria-roledescription={multiple ? "slide" : undefined}
            aria-label={multiple ? `${i + 1} de ${count}` : undefined}
            data-active={active ? "" : undefined}
            inert={!active}
          >
            <BannerSlideContext value={{ active, near: active || seen.has(slide.id), playing: choice !== false }}>{slide.content}</BannerSlideContext>
          </div>
        );
      })}
    </div>
  );

  if (!multiple) {
    return (
      <section className="s-banners" aria-label={label} data-reduced={reducedMotion ? "" : undefined}>
        {heading}
        <div className="s-banners__viewport">{stage}</div>
      </section>
    );
  }

  return (
    <section
      className="s-banners"
      aria-roledescription="carousel"
      aria-label={label}
      data-running={running ? "" : undefined}
      data-rotating={rotating ? "" : undefined}
      data-reduced={reducedMotion ? "" : undefined}
      onKeyDown={onKeyDown}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovering(true);
      }}
      onPointerLeave={() => setHovering(false)}
      onFocus={(event) => {
        // só o foco de TECLADO suspende a troca: clicar numa seta com o mouse não deixa o carrossel parado
        if ((event.target as HTMLElement).matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {heading}
      <div className="s-banners__viewport">
        {/* Controles ANTES dos banners no HTML (ordem do teclado e dos leitores de tela); o CSS os mostra embaixo. */}
        <div className="s-banners__bar">
          <div className="s-wrap s-banners__bar-in">
            <button
              type="button"
              className="s-banners__btn s-banners__toggle"
              aria-label={rotating ? "Pausar a troca automática dos banners" : "Retomar a troca automática dos banners"}
              onClick={() => {
                left.current = null;
                setChoice(!rotating);
              }}
            >
              <PauseIcon paused={!rotating} />
            </button>
            <div className="s-banners__dots" role="group" aria-label="Escolher banner">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  className="s-banners__dot"
                  aria-label={`Banner ${i + 1} de ${count}`}
                  aria-current={i === index ? "true" : undefined}
                  aria-controls={stageId}
                  style={i === index ? ({ "--dur": `${duration}ms` } as React.CSSProperties) : undefined}
                  onClick={() => jump(i)}
                >
                  <span aria-hidden="true">
                    <i />
                  </span>
                </button>
              ))}
            </div>
            <p className="s-banners__count" aria-hidden="true">
              <b>{pad2(index + 1)}</b> / {pad2(count)}
            </p>
            <div className="s-banners__arrows">
              <button type="button" className="s-banners__btn" aria-label="Banner anterior" aria-controls={stageId} onClick={() => jump(index - 1)}>
                <Icon name="arrow" className="s-banners__prev" />
              </button>
              <button type="button" className="s-banners__btn" aria-label="Próximo banner" aria-controls={stageId} onClick={() => jump(index + 1)}>
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        </div>
        {stage}
      </div>
    </section>
  );
}
