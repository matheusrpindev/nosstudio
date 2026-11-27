/**
 * Ilustrações do rodapé interativo: a câmera instantânea (SVG próprio, nada de foto) e as composições gráficas da
 * marca que aparecem na foto instantânea e na tela do celular enquanto os sócios não cadastram fotos/trechos.
 * Server Components puros: o desenho chega pronto no HTML (sem salto de layout) e não pesa no JavaScript.
 *
 * As partes animadas têm classes `fx-*` (lente, foco, íris, flash, botão do obturador) — quem anima é o CSS de
 * footer-experience.css, a partir dos atributos que o motor (footer-experience-engine.ts) põe na raiz.
 */
import { Logo } from "@/components/brand/logo";
import { LOGO_SHAPES } from "@/components/brand/logo-data";
import { Accented } from "./layout";

const CX = 200;
const CY = 168;

/** Lâminas da íris: seis triângulos que, fechados, cobrem o vidro; abertos, ficam fora do recorte. */
const PETAL = `M${CX} ${CY} L${CX} ${CY - 70} L${(CX + 70 * Math.cos(Math.PI / 6)).toFixed(1)} ${CY - 35} Z`;

/** A câmera instantânea da marca. Decorativa: o rótulo acessível vem do botão em volta. */
export function CameraArt() {
  const mark = LOGO_SHAPES.wordmark;
  return (
    <svg viewBox="0 0 400 300" className="s-fx__camera-art" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fx-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#373742" />
          <stop offset="0.42" stopColor="#24242C" />
          <stop offset="1" stopColor="#141419" />
        </linearGradient>
        <linearGradient id="fx-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id="fx-glass" cx="0.4" cy="0.36" r="0.72">
          <stop offset="0" stopColor="#6A4FD6" />
          <stop offset="0.32" stopColor="#3B1F8E" />
          <stop offset="0.72" stopColor="#17112C" />
          <stop offset="1" stopColor="#09070F" />
        </radialGradient>
        <linearGradient id="fx-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A4A58" />
          <stop offset="1" stopColor="#101014" />
        </linearGradient>
        <linearGradient id="fx-flashwin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6F4EF" />
          <stop offset="1" stopColor="#CFC6FF" />
        </linearGradient>
        <linearGradient id="fx-lima" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E2FF7A" />
          <stop offset="0.55" stopColor="#C6F432" />
          <stop offset="1" stopColor="#A9D11F" />
        </linearGradient>
        <clipPath id="fx-iris-clip">
          <circle cx={CX} cy={CY} r="50" />
        </clipPath>
      </defs>

      {/* sombra no chão */}
      <ellipse cx="200" cy="288" rx="172" ry="9" fill="#1B1B22" opacity="0.16" />

      {/* corcunda de cima: flash e sensor */}
      <rect x="36" y="22" width="178" height="60" rx="16" fill="url(#fx-body)" />
      <rect x="50" y="35" width="98" height="33" rx="7" fill="url(#fx-flashwin)" />
      <g stroke="#3B1F8E" strokeOpacity="0.16" strokeWidth="1.5">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={58 + i * 8} y1="38" x2={58 + i * 8} y2="65" />
        ))}
      </g>
      <rect className="fx-flashglow" x="50" y="35" width="98" height="33" rx="7" fill="#FFFFFF" />
      <circle cx="180" cy="51" r="9" fill="#101014" />
      <circle cx="180" cy="51" r="4.5" fill="#3B1F8E" />

      {/* botão do obturador */}
      <rect x="290" y="38" width="66" height="24" rx="10" fill="#7E9B16" />
      <g className="fx-shutter">
        <rect x="290" y="30" width="66" height="24" rx="10" fill="url(#fx-lima)" />
        <rect x="300" y="34" width="46" height="4" rx="2" fill="#FFFFFF" opacity="0.45" />
      </g>

      {/* corpo */}
      <rect x="16" y="56" width="368" height="216" rx="36" fill="url(#fx-body)" />
      <rect x="64" y="56" width="14" height="216" fill="#3B1F8E" />
      <rect x="82" y="56" width="14" height="216" fill="#CFC6FF" />
      <rect x="100" y="56" width="14" height="216" fill="#C6F432" />
      <rect x="16" y="56" width="368" height="216" rx="36" fill="url(#fx-sheen)" />
      <rect x="17" y="57" width="366" height="214" rx="35" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="2" />
      <path d="M56 59.5H344" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="2" strokeLinecap="round" />

      {/* visor */}
      <rect x="300" y="80" width="60" height="40" rx="11" fill="#0C0C10" />
      <rect x="306" y="86" width="48" height="28" rx="7" fill="url(#fx-glass)" />
      <path d="M313 93h13" stroke="#CFC6FF" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />

      {/* assinatura da marca no corpo */}
      <svg x="303" y="226" width="54" height={(54 * mark.height) / mark.width} viewBox={`0 0 ${mark.width} ${mark.height}`}>
        <path d={mark.letters} fill="#F6F4EF" fillRule="evenodd" opacity="0.92" />
        <path d={mark.accent} fill="#C6F432" />
      </svg>

      {/* lente */}
      <g className="fx-lens">
        <circle cx={CX} cy={CY} r="97" fill="#0C0C10" />
        <circle cx={CX} cy={CY} r="94" fill="none" stroke="url(#fx-ring)" strokeWidth="4" />
        <g className="fx-focus">
          <circle cx={CX} cy={CY} r="84" fill="#25252E" />
          <circle cx={CX} cy={CY} r="84" fill="none" stroke="#3C3C49" strokeWidth="10" strokeDasharray="2.6 4.4" />
          <circle cx={CX} cy={CY - 84} r="3" fill="#C6F432" />
        </g>
        <circle cx={CX} cy={CY} r="72" fill="#0C0C10" />
        <circle cx={CX} cy={CY} r="69" fill="none" stroke="#3B1F8E" strokeWidth="2" />
        <circle cx={CX} cy={CY} r="60" fill="#18181E" />
        <circle cx={CX} cy={CY} r="50" fill="url(#fx-glass)" />
        <g clipPath="url(#fx-iris-clip)">
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i} transform={`rotate(${i * 60} ${CX} ${CY})`}>
              <path className="fx-petal" d={PETAL} fill="#24242D" stroke="#4A3A9C" strokeWidth="1.4" strokeLinejoin="round" />
            </g>
          ))}
        </g>
        <path d="M170 141a42 42 0 0 1 38-19" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
        <circle cx="226" cy="146" r="4" fill="#FFFFFF" opacity="0.7" />
        <circle cx="186" cy="190" r="14" fill="#CFC6FF" opacity="0.1" />
      </g>

      {/* fenda de saída da foto */}
      <rect x="122" y="250" width="156" height="9" rx="4.5" fill="#060608" />
      <rect x="122" y="258" width="156" height="2" rx="1" fill="#FFFFFF" opacity="0.08" />
    </svg>
  );
}

/**
 * Composição gráfica da marca (formas + o Ó do logo + visor): o "conteúdo" da foto instantânea enquanto não há
 * fotos cadastradas. Três variações de cor (`data-variant` 0, 1, 2), alternadas a cada clique pelo motor.
 */
export function BrandComposition({ variant = 0 }: { variant?: number }) {
  return (
    <div className="s-fx__comp" data-variant={variant} aria-hidden="true">
      <span className="s-fx__comp-sun" />
      <span className="s-fx__comp-ring" />
      <span className="s-fx__comp-bar" />
      <span className="s-fx__comp-mark">
        <Logo variant="simbolo" tone="branco" label="" className="h-full w-auto" />
      </span>
      <span className="s-frame s-fx__comp-frame" />
    </div>
  );
}

/** Tela do celular parada: assinatura, a frase da marca e formas que se movem durante o REC (sem trechos). */
export function PhoneIdleScreen({ frameText }: { frameText: string }) {
  return (
    <div className="s-fx__screen-idle" aria-hidden="true">
      <span className="s-fx__take-shape s-fx__take-shape--sun" />
      <span className="s-fx__take-shape s-fx__take-shape--ring" />
      <span className="s-fx__take-shape s-fx__take-shape--bar" />
      <Logo variant="wordmark" tone="branco" label="" className="s-fx__screen-logo" />
      {frameText ? (
        <p className="s-fx__screen-text">
          <Accented text={frameText} fallback="tail" />
        </p>
      ) : null}
    </div>
  );
}
