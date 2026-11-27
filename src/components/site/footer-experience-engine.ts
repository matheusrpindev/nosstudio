/**
 * Motor do rodapé interativo (câmera e celular simulados). Baixado sob demanda por <FooterExperienceLoader>
 * quando a seção chega perto da tela; não é um componente React — liga eventos ao HTML que o servidor já
 * desenhou e só mexe em atributos `data-fx-*` da raiz (o CSS anima a partir deles), em textos dos marcadores
 * (`data-fx-timer`, `data-fx-record-label`…) e nos contêineres vazios que existem para isso (`data-fx-tray`,
 * `data-fx-clips`).
 *
 * Regras:
 * - SIMULAÇÃO: nada de getUserMedia, nada de gravar, nada de enviar. As fotos e os trechos são os do painel.
 * - `prefers-reduced-motion`: sem flash e sem animação — só a troca de estado (a foto aparece já revelada).
 * - Som: desligado por padrão; o áudio (Web Audio, sintetizado) só é criado no clique em "Ligar som" e só toca
 *   em resposta a um clique do visitante.
 */
import type { PublicFooterClip, PublicFooterPhoto } from "@/lib/site/footer-experience";
import type { FooterSound } from "./footer-experience-sound";

export type FooterEngineData = { photos: PublicFooterPhoto[]; clips: PublicFooterClip[]; frameText: string };

/** Fotos visíveis ao mesmo tempo (a nova na frente, as anteriores espalhadas atrás). */
const PRINTS_ON_TABLE = 3;
/** O REC para sozinho depois disto (e quando a seção sai da tela ou a aba fica oculta). */
const MAX_RECORDING_MS = 60_000;

const pad = (value: number) => String(value).padStart(2, "0");
const clock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
};

export function mountFooterExperience(root: HTMLElement, data: FooterEngineData, pendingAction: string | null): () => void {
  const find = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const flash = find(".s-fx__flash");
  const tray = find("[data-fx-tray]");
  const template = find("[data-fx-print-template]");
  const clipsLayer = find("[data-fx-clips]");
  const timerEl = find("[data-fx-timer]");
  const takeEl = find("[data-fx-take]");
  const captionEl = find("[data-fx-clip-caption]");
  const recordLabel = find("[data-fx-record-label]");
  const soundLabel = find("[data-fx-sound-label]");
  const status = find("[data-fx-status]");
  const stage = find(".s-fx__stage") ?? root;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => motion.matches;
  const timers = new Set<number>();
  const later = (run: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      run();
    }, ms);
    timers.add(id);
    return id;
  };

  let disposed = false;
  let sound: FooterSound | null = null;
  let soundOn = false;
  let soundLoading = false;
  const play = (cue: keyof Omit<FooterSound, "resume" | "close">) => {
    if (soundOn && sound) sound[cue]();
  };

  /** Mensagem para leitores de tela (esvazia antes para repetir a mesma frase). */
  const announce = (message: string) => {
    if (!status) return;
    status.textContent = "";
    later(() => {
      status.textContent = message;
    }, 60);
  };

  root.dataset.fxReady = "true";

  // ------------------------------------------------------------------ câmera
  let shots = 0;
  let busy = false;

  function makePrint(photo: PublicFooterPhoto | null, index: number): HTMLElement | null {
    if (!template) return null;
    const print = template.cloneNode(true) as HTMLElement;
    print.removeAttribute("hidden");
    print.removeAttribute("data-fx-print-template");
    print.dataset.fxPrint = "";
    const composition = print.querySelector(".s-fx__comp");
    if (photo) {
      const img = document.createElement("img");
      img.className = "s-fx__print-img";
      img.alt = photo.alt;
      img.width = photo.width;
      img.height = photo.height;
      img.decoding = "async";
      if (photo.srcSet) {
        img.srcset = photo.srcSet;
        img.sizes = "(min-width: 1024px) 14rem, 38vw";
      }
      img.src = photo.url;
      composition?.replaceWith(img);
    } else {
      composition?.setAttribute("data-variant", String(index % 3));
    }
    return print;
  }

  /** Põe a foto nova na frente e empurra as anteriores para os lados (a mais antiga sai). */
  function placePrint(print: HTMLElement, instant: boolean) {
    if (!tray) return;
    const previous = [...tray.querySelectorAll<HTMLElement>("[data-fx-print]")];
    for (const item of previous) {
      const position = Number(item.dataset.fxPos ?? 0) + 1;
      item.dataset.fxPos = String(position);
      item.setAttribute("aria-hidden", "true");
      if (position >= PRINTS_ON_TABLE) {
        if (instant) item.remove();
        else {
          item.dataset.fxState = "gone";
          later(() => item.remove(), 600);
        }
      }
    }
    print.dataset.fxPos = "0";
    print.dataset.fxState = instant ? "developed" : "ejecting";
    tray.append(print);
    if (instant) return;
    // força o estado inicial (dentro da fenda) a ser pintado antes da transição de saída
    void print.offsetWidth;
    print.dataset.fxState = "out";
    later(() => {
      print.dataset.fxState = "developed";
    }, 950);
  }

  function shoot() {
    if (busy) return;
    busy = true;
    const index = shots++;
    const photo = data.photos.length > 0 ? data.photos[index % data.photos.length] : null;
    const print = makePrint(photo, index);
    const message = photo ? `Foto revelada: ${photo.alt}` : data.frameText ? `Foto revelada: ${data.frameText.replace(/\*/g, "")}` : "Foto revelada.";
    play("shutter");

    if (reduced()) {
      if (print) placePrint(print, true);
      announce(message);
      busy = false;
      return;
    }
    root.dataset.fxShot = "press";
    later(() => {
      root.dataset.fxShot = "fire";
      flash?.animate([{ opacity: 0 }, { opacity: 0.92, offset: 0.12 }, { opacity: 0 }], { duration: 460, easing: "ease-out" });
    }, 110);
    later(() => {
      root.dataset.fxShot = "open";
    }, 270);
    later(() => {
      delete root.dataset.fxShot;
      if (print) placePrint(print, false);
      play("eject");
      announce(message);
    }, 430);
    later(() => {
      busy = false;
    }, 1150);
  }

  // ------------------------------------------------------------------ celular
  let recording = false;
  let startedAt = 0;
  let take = 0;
  let tick = 0;
  let autoStop = 0;
  let clipIndex = -1;

  const setTimer = (ms: number) => {
    if (timerEl) timerEl.textContent = clock(ms);
  };

  function showClip() {
    if (!clipsLayer || data.clips.length === 0) return;
    clipIndex = (clipIndex + 1) % data.clips.length;
    const clip = data.clips[clipIndex];
    const video = document.createElement("video");
    video.className = "s-fx__clip";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.preload = "auto";
    video.loop = data.clips.length === 1;
    video.src = clip.url;
    video.addEventListener("ended", () => {
      if (recording) showClip();
    });
    // o trecho anterior só sai quando o novo já tem imagem (sem piscar preto)
    const previous = [...clipsLayer.children];
    video.addEventListener(
      "playing",
      () => {
        for (const old of previous) {
          if (old instanceof HTMLVideoElement) old.pause();
          old.remove();
        }
      },
      { once: true },
    );
    clipsLayer.append(video);
    video.play().catch(() => undefined);
    if (captionEl) captionEl.textContent = clip.caption;
  }

  function clearClips() {
    if (clipsLayer) {
      for (const node of [...clipsLayer.children]) {
        if (node instanceof HTMLVideoElement) {
          node.pause();
          node.removeAttribute("src");
          node.load();
        }
        node.remove();
      }
    }
    if (captionEl) captionEl.textContent = "";
    clipIndex = -1;
  }

  function startRecording() {
    recording = true;
    take += 1;
    startedAt = performance.now();
    root.dataset.fxRec = "on";
    if (takeEl) takeEl.textContent = `Take ${pad(take)}`;
    if (recordLabel) recordLabel.textContent = "Parar";
    setTimer(0);
    tick = window.setInterval(() => setTimer(performance.now() - startedAt), 250);
    autoStop = later(() => stopRecording(false), MAX_RECORDING_MS);
    showClip();
    play("recStart");
    announce("Gravando. Aperte Parar para encerrar.");
  }

  function stopRecording(byClick: boolean) {
    if (!recording) return;
    recording = false;
    window.clearInterval(tick);
    window.clearTimeout(autoStop);
    timers.delete(autoStop);
    const elapsed = performance.now() - startedAt;
    setTimer(elapsed);
    root.dataset.fxRec = "done";
    if (recordLabel) recordLabel.textContent = "Gravar";
    clearClips();
    if (byClick) play("recStop");
    announce(`Gravação encerrada: ${clock(elapsed)}.`);
  }

  // ------------------------------------------------------------------ som
  async function toggleSound() {
    if (soundLoading) return;
    if (soundOn) {
      soundOn = false;
    } else {
      if (!sound) {
        soundLoading = true;
        try {
          const { createFooterSound } = await import("./footer-experience-sound");
          sound = disposed ? null : createFooterSound();
        } catch {
          sound = null;
        } finally {
          soundLoading = false;
        }
        if (disposed) return;
        if (!sound) {
          announce("Este navegador não consegue tocar o som.");
          return;
        }
      }
      sound.resume();
      soundOn = true;
      sound.blip();
    }
    root.dataset.fxSound = soundOn ? "on" : "off";
    if (soundLabel) soundLabel.textContent = soundOn ? "Desligar som" : "Ligar som";
    announce(soundOn ? "Som ligado." : "Som desligado.");
  }

  // ------------------------------------------------------------------ eventos
  function run(action: string | null | undefined) {
    if (action === "shoot") shoot();
    else if (action === "record") {
      if (recording) stopRecording(true);
      else startRecording();
    } else if (action === "sound") void toggleSound();
  }

  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element | null)?.closest?.("[data-fx-action]");
    if (button && root.contains(button)) run(button.getAttribute("data-fx-action"));
  };
  root.addEventListener("click", onClick);

  // fora da tela ou com a aba oculta, o REC para (nada de vídeo tocando escondido)
  const visibility = new IntersectionObserver((entries) => {
    if (entries.some((entry) => !entry.isIntersecting)) stopRecording(false);
  });
  visibility.observe(stage);
  const onHidden = () => {
    if (document.hidden) stopRecording(false);
  };
  document.addEventListener("visibilitychange", onHidden);

  if (pendingAction) run(pendingAction);

  return () => {
    disposed = true;
    root.removeEventListener("click", onClick);
    document.removeEventListener("visibilitychange", onHidden);
    visibility.disconnect();
    window.clearInterval(tick);
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    clearClips();
    tray?.querySelectorAll("[data-fx-print]").forEach((node) => node.remove());
    for (const key of ["fxReady", "fxShot", "fxRec", "fxSound"]) delete root.dataset[key];
    if (recordLabel) recordLabel.textContent = "Gravar";
    if (soundLabel) soundLabel.textContent = "Ligar som";
    setTimer(0);
    sound?.close();
    sound = null;
  };
}
