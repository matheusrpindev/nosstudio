"use client";

/**
 * Mídia de um banner: imagem com versão de computador e de celular (<picture>) e, opcionalmente, um vídeo curto
 * de fundo por cima dela.
 *
 * - Sem salto de layout: a mídia cobre a área do banner (que tem proporção fixa) e as imagens levam largura e
 *   altura. Enquanto carrega, aparece a cor dominante da imagem.
 * - A imagem do primeiro banner carrega com prioridade; as dos outros só entram no HTML quando o carrossel avisa
 *   que estão perto de aparecer (`near`).
 * - Vídeo: mudo, em loop, `playsInline`, sem controles. Só existe no DOM (e só baixa) enquanto o banner está em
 *   tela; não carrega para quem pediu menos movimento (`prefers-reduced-motion`) ou economia de dados
 *   (`Save-Data`) — fica a imagem de capa. Acompanha o botão de pausa do carrossel.
 */
import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PublicImage } from "@/lib/media";
import type { BannerVideo, BannerViewport } from "@/lib/site/banners";
import { BannerSlideContext } from "./banner-context";

/** Largura a partir da qual vale a versão de computador (a mesma do CSS: `@container banners (min-width: 640px)`). */
const DESKTOP_MIN = 640;

function srcSet(image: PublicImage): string {
  // as versões menores geradas no upload + a principal (um banner ocupa a largura toda da tela)
  return [...image.sources, { width: image.width, url: image.url }].map((source) => `${source.url} ${source.width}w`).join(", ");
}

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeMotion(notify: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
/** O navegador deixa tocar vídeo de fundo? (Não com movimento reduzido nem com economia de dados.) */
const videoAllowed = () => !window.matchMedia(REDUCED).matches && !(navigator as NavigatorWithConnection).connection?.saveData;

function BackgroundVideo({ video, playing }: { video: BannerVideo; playing: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (playing) {
      element.muted = true; // garantia para a política de autoplay
      void element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [playing]);

  return (
    <video
      ref={ref}
      className="s-banner__video"
      data-ready={ready ? "" : undefined}
      muted
      loop
      playsInline
      autoPlay={playing}
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setReady(true)}
    >
      <source src={video.url} type={video.mime} />
    </video>
  );
}

export function BannerMedia({
  desktop,
  mobile,
  video,
  alt,
  priority = false,
  viewport,
}: {
  desktop: PublicImage | null;
  mobile: PublicImage | null;
  video?: BannerVideo | null;
  /** Texto alternativo ("" = imagem decorativa: o texto do banner já diz tudo). */
  alt: string;
  /** Primeiro banner: a imagem carrega com prioridade. */
  priority?: boolean;
  /** Força uma versão (prévia do painel). Sem isto, o navegador escolhe pela largura da tela. */
  viewport?: BannerViewport;
}) {
  const { active, near, playing } = use(BannerSlideContext);
  const canPlay = useSyncExternalStore(subscribeMotion, videoAllowed, () => false);

  // imagem principal do <img> e, se houver as duas versões, a de celular num <source>
  const forced = viewport === "mobile" ? (mobile ?? desktop) : viewport === "desktop" ? (desktop ?? mobile) : null;
  const main = forced ?? desktop ?? mobile;
  const small = !viewport && desktop && mobile ? mobile : null;
  const show = priority || near;

  return (
    <div className="s-banner__media" style={{ backgroundColor: main?.placeholderColor ?? undefined }}>
      {main && show ? (
        <picture>
          {small ? <source media={`(max-width: ${DESKTOP_MIN - 1}px)`} srcSet={srcSet(small)} sizes="100vw" width={small.width} height={small.height} /> : null}
          {/* <img> comum (não next/image): as versões responsivas já vêm do pipeline de upload */}
          <img
            src={main.url}
            srcSet={srcSet(main)}
            sizes="100vw"
            width={main.width}
            height={main.height}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
          />
        </picture>
      ) : null}
      {video && active && canPlay ? <BackgroundVideo video={video} playing={playing} /> : null}
    </div>
  );
}
