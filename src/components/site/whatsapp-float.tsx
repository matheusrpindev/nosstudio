"use client";

import { useEffect, useState } from "react";
import { Icon } from "./marks";

/** Blocos que o botão não deve cobrir: os CTAs de abertura da página e os formulários. */
const AVOID = ".s-hero__actions, .s-pagehead__actions, .s-form";

/**
 * Botão flutuante de WhatsApp (só no celular — some a partir de 1024px via CSS). Para não cobrir conteúdo
 * nem CTAs, ele se recolhe enquanto os botões de abertura da página ou um formulário estão na tela; o rodapé
 * reserva espaço para ele no fim da página. Sem JS, fica sempre visível.
 */
export function WhatsAppFloat({ href, label }: { href: string; label: string }) {
  const [tucked, setTucked] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      for (const el of visible) if (!el.isConnected) visible.delete(el);
      setTucked(visible.size > 0);
    });
    const watched = new WeakSet<Element>();
    const scan = () => {
      for (const el of document.querySelectorAll(AVOID)) {
        if (watched.has(el)) continue;
        watched.add(el);
        io.observe(el);
      }
    };
    scan();
    // navegação entre páginas troca o conteúdo do <main>
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <a
      className="s-wa"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      data-tucked={tucked ? "true" : undefined}
      tabIndex={tucked ? -1 : undefined}
    >
      <Icon name="whatsapp" />
    </a>
  );
}
