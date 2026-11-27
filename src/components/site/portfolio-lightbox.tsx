"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PublicImage } from "@/lib/media";
import { SiteImage } from "./site-image";

/** Quanto o dedo/mouse precisa andar na horizontal para trocar de imagem. */
const SWIPE_DISTANCE = 48;

/**
 * Ampliação das imagens de uma galeria (lightbox). É um `<dialog>` modal nativo: o navegador prende o foco
 * dentro dele, torna o resto da página inerte, fecha com Esc e devolve o foco a quem abriu.
 *
 * Teclado: ← → trocam de imagem, Home/End vão para a primeira/última, Esc fecha.
 * Toque/mouse: arrastar para os lados troca de imagem; tocar fora da imagem fecha.
 * `prefers-reduced-motion`: sem transições (portfolio.css).
 */
export function PortfolioLightbox({
  images,
  index,
  label,
  onIndexChange,
  onClose,
}: {
  images: PublicImage[];
  /** Imagem aberta. */
  index: number;
  /** Nome do diálogo para leitores de tela ("Galeria do projeto X"). */
  label: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  /** O gesto que acabou de terminar foi um arrasto? (o `click` que vem depois dele não pode fechar o diálogo) */
  const dragged = useRef(false);
  const [drag, setDrag] = useState(0);
  const total = images.length;
  const image = images[index];
  const many = total > 1;

  const go = useCallback((next: number) => onIndexChange((next + total) % total), [onIndexChange, total]);

  // Abre como modal ao montar. Não há `close()` na limpeza de propósito: fechar dispara o evento `close` (que
  // desmonta o componente), e em desenvolvimento o React roda efeito → limpeza → efeito. Ao sair do DOM o
  // navegador já tira o diálogo da camada superior; todo fechamento "de verdade" passa por `dialog.close()`.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    // Tab dá a volta dentro do diálogo (o modal nativo já impede o foco de ir para a página; isto evita também
    // que ele escape para a barra do navegador)
    if (event.key === "Tab") {
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last) {
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (!many) return;
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(total - 1);
    else return;
    event.preventDefault();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!many || (event.pointerType === "mouse" && event.button !== 0)) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    dragged.current = false;
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const from = start.current;
    if (!from || from.id !== event.pointerId) return;
    const dx = event.clientX - from.x;
    // só acompanha o gesto quando ele é claramente horizontal (a rolagem vertical continua do navegador)
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(event.clientY - from.y)) setDrag(dx);
  }
  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const from = start.current;
    if (!from || from.id !== event.pointerId) return;
    start.current = null;
    const dx = event.clientX - from.x;
    dragged.current = Math.abs(dx) > 8;
    setDrag(0);
    if (event.type === "pointerup" && Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(event.clientY - from.y)) {
      // troca a imagem só depois de o gesto terminar: tirar do DOM o elemento que está sendo tocado, no meio do
      // toque, deixa o navegador sem alvo para o `touchend` (e o toque seguinte pode não virar clique)
      const target = index + (dx < 0 ? 1 : -1);
      setTimeout(() => go(target), 0);
    }
  }

  if (!image) return null;
  const moved = Math.abs(drag) > 8;

  return (
    <dialog
      ref={dialogRef}
      className="portfolio-lightbox"
      aria-label={label}
      onClose={onClose}
      onKeyDown={onKeyDown}
      // clique no fundo (fora da imagem e dos botões) fecha — mas não o fim de um arrasto
      onClick={(event) => {
        const wasDrag = dragged.current;
        dragged.current = false;
        const target = event.target as HTMLElement;
        if (wasDrag || target instanceof HTMLImageElement || target.closest("[data-lightbox-keep]")) return;
        dialogRef.current?.close();
      }}
    >
      <div className="portfolio-lightbox__bar" data-lightbox-keep="">
        <p className="portfolio-lightbox__count" aria-live="polite" aria-atomic="true">
          <span className="sr-only">Imagem </span>
          <b>{String(index + 1).padStart(2, "0")}</b>
          <span aria-hidden="true"> / </span>
          <span className="sr-only"> de </span>
          {String(total).padStart(2, "0")}
        </p>
        <button type="button" className="portfolio-lightbox__btn" autoFocus onClick={() => dialogRef.current?.close()} aria-label="Fechar a ampliação">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 5l14 14M19 5 5 19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </svg>
        </button>
      </div>

      <div
        className="portfolio-lightbox__stage"
        data-dragging={moved || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
      >
        <figure className="portfolio-lightbox__figure" style={moved ? { transform: `translateX(${drag}px)` } : undefined}>
          <SiteImage key={image.id} image={image} alt={image.alt || `${label} — imagem ${index + 1} de ${total}`} sizes="100vw" priority className="portfolio-lightbox__img" />
        </figure>
      </div>

      {many ? (
        <div className="portfolio-lightbox__nav" data-lightbox-keep="">
          <button type="button" className="portfolio-lightbox__btn" onClick={() => go(index - 1)} aria-label="Imagem anterior">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M21 12H4M11 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>
          <button type="button" className="portfolio-lightbox__btn" onClick={() => go(index + 1)} aria-label="Próxima imagem">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 12h17M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
