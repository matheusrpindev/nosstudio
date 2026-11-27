/**
 * Sons do rodapé interativo, sintetizados na hora com Web Audio (nenhum arquivo baixado). Só é carregado e criado
 * quando o visitante clica em "Ligar som" — e cada som só toca em resposta a um clique dele.
 */
export type FooterSound = {
  /** Obturador: dois estalos (cortina e espelho) e um baque grave. */
  shutter(): void;
  /** Motor da câmera instantânea empurrando a foto para fora. */
  eject(): void;
  /** Dois bipes curtos: começou a gravar. */
  recStart(): void;
  /** Um bipe mais grave: parou. */
  recStop(): void;
  /** Confirmação discreta ao ligar o som. */
  blip(): void;
  resume(): void;
  close(): void;
};

type AudioContextCtor = typeof AudioContext;

export function createFooterSound(): FooterSound | null {
  const Ctor: AudioContextCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  const master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);

  // meio segundo de ruído branco, reaproveitado por todos os estalos
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const channel = noise.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;

  const click = (at: number, duration: number, frequency: number, gain: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(env).connect(master);
    source.start(at);
    source.stop(at + duration + 0.02);
  };

  const tone = (at: number, duration: number, frequency: number, gain: number, type: OscillatorType = "sine") => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env).connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  };

  return {
    shutter() {
      const t = ctx.currentTime + 0.005;
      click(t, 0.05, 3400, 0.9);
      tone(t, 0.07, 150, 0.28);
      click(t + 0.085, 0.07, 1900, 0.65);
    },
    eject() {
      const t = ctx.currentTime + 0.005;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(92, t);
      osc.frequency.linearRampToValueAtTime(118, t + 0.25);
      osc.frequency.linearRampToValueAtTime(96, t + 0.6);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 520;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
      env.gain.setValueAtTime(0.16, t + 0.5);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.66);
      osc.connect(filter).connect(env).connect(master);
      osc.start(t);
      osc.stop(t + 0.7);
    },
    recStart() {
      const t = ctx.currentTime + 0.005;
      tone(t, 0.08, 880, 0.22);
      tone(t + 0.13, 0.08, 880, 0.22);
    },
    recStop() {
      tone(ctx.currentTime + 0.005, 0.16, 560, 0.24);
    },
    blip() {
      const t = ctx.currentTime + 0.005;
      tone(t, 0.06, 660, 0.16);
      tone(t + 0.07, 0.09, 990, 0.16);
    },
    resume() {
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    },
    close() {
      void ctx.close().catch(() => undefined);
    },
  };
}
