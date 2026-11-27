"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { PublicImage } from "@/lib/media";
import { SiteImage } from "./site-image";

/**
 * Comparação "antes e depois" com controle deslizante.
 *
 * Por baixo há um `<input type="range">` de verdade: é ele que recebe o foco e responde ao teclado (← → movem
 * 1%, PageUp/PageDown 10%, Home/End vão às pontas) e a leitores de tela. Para mouse e toque, o quadro inteiro
 * arrasta a divisória (o range nativo exigiria acertar o polegar); a rolagem vertical da página continua livre.
 * Sem JavaScript, a comparação fica parada no meio, com as duas metades visíveis.
 */
export function PortfolioBeforeAfter({
  before,
  after,
  caption,
  beforeLabel,
  afterLabel,
}: {
  before: PublicImage;
  after: PublicImage;
  caption?: string;
  /** Etiquetas das metades ("Antes" / "Depois"). */
  beforeLabel: string;
  afterLabel: string;
}) {
  const [position, setPosition] = useState(50);
  const stage = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const moveTo = (clientX: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    setPosition(Math.round(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100))));
  };

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
    range.current?.focus({ preventScroll: true });
    // sem isto o navegador começaria a arrastar a imagem (mouse)
    if (event.pointerType === "mouse") event.preventDefault();
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragging.current) moveTo(event.clientX);
  }
  function onPointerEnd() {
    dragging.current = false;
  }

  const labelBefore = beforeLabel || "Antes";
  const labelAfter = afterLabel || "Depois";

  return (
    <figure className="portfolio-compare" data-portrait={after.height > after.width || undefined}>
      <div
        ref={stage}
        className="portfolio-compare__stage"
        style={{ "--pos": `${position}%`, aspectRatio: `${after.width} / ${after.height}` } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <SiteImage image={after} alt={`${labelAfter}: ${after.alt}`} sizes="(min-width: 1024px) 60vw, 100vw" className="portfolio-compare__img" />
        <div className="portfolio-compare__before">
          <SiteImage image={before} alt={`${labelBefore}: ${before.alt}`} sizes="(min-width: 1024px) 60vw, 100vw" className="portfolio-compare__img" />
        </div>
        <span className="portfolio-compare__tag" data-side="before" aria-hidden="true">
          {labelBefore}
        </span>
        <span className="portfolio-compare__tag" data-side="after" aria-hidden="true">
          {labelAfter}
        </span>
        <span className="portfolio-compare__handle" aria-hidden="true">
          <span className="portfolio-compare__grip">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </span>
        </span>
        <input
          ref={range}
          type="range"
          className="portfolio-compare__range"
          min={0}
          max={100}
          step={1}
          value={position}
          aria-label={caption ? `Comparar ${labelBefore.toLowerCase()} e ${labelAfter.toLowerCase()}: ${caption}` : `Comparar ${labelBefore.toLowerCase()} e ${labelAfter.toLowerCase()}`}
          aria-valuetext={`${position}% da imagem de ${labelBefore.toLowerCase()} à mostra`}
          onChange={(event) => setPosition(Number(event.target.value))}
          onKeyDown={(event) => {
            // PageUp/PageDown em passos de 10% (o padrão varia entre navegadores)
            if (event.key === "PageUp" || event.key === "PageDown") {
              event.preventDefault();
              setPosition((current) => Math.min(100, Math.max(0, current + (event.key === "PageUp" ? 10 : -10))));
            }
          }}
        />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
