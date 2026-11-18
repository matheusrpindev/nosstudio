"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { videoEmbedUrl } from "@/lib/format";
import type { PublicImage } from "@/lib/media";
import { PlayMark, RecDot, ViewfinderFrame } from "./marks";
import { SiteImage } from "./site-image";

/**
 * Vídeo do YouTube (modo sem cookies) ou Vimeo carregado só quando o visitante clica: até lá não há
 * iframe, nem rede de terceiros, nem cookies. Sem capa, mostra o estado gráfico da marca.
 * Links que não são de YouTube/Vimeo não renderizam nada.
 */
export function VideoEmbed({
  url,
  title,
  poster,
  ratio = "16 / 9",
  className,
}: {
  url: string | null | undefined;
  /** Título do vídeo (acessibilidade: vira o rótulo do botão e do iframe). */
  title: string;
  poster?: PublicImage | null;
  /** Proporção do quadro, ex.: "16 / 9" (padrão) ou "9 / 16" para vídeos verticais. */
  ratio?: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const embed = videoEmbedUrl(url);

  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  if (!embed) return null;
  const src = `${embed}${embed.includes("?") ? "&" : "?"}autoplay=1&rel=0`;

  return (
    <div
      className={cn("s-video", className)}
      data-tone="grafite"
      data-poster={poster ? "true" : undefined}
      style={{ "--ratio": ratio } as CSSProperties}
    >
      {playing ? (
        <iframe
          ref={frame}
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <>
          {poster ? <SiteImage image={poster} alt="" className="s-media" sizes="(min-width: 1024px) 60vw, 100vw" /> : null}
          <ViewfinderFrame />
          <RecDot />
          <button type="button" className="s-video__btn" onClick={() => setPlaying(true)} aria-label={`Reproduzir vídeo: ${title}`}>
            <span className="s-video__play">
              <PlayMark />
            </span>
          </button>
        </>
      )}
    </div>
  );
}
