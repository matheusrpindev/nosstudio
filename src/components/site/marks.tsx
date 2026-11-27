/**
 * Ícones e marcas gráficas do site público. Tudo SVG inline, sem JS no cliente.
 * Os motivos (acento, play, cantoneiras, anéis) saem do logo, nas proporções originais.
 */
import type { CSSProperties, SVGProps } from "react";
import { cn } from "@/lib/cn";

// ------------------------------------------------------------------ ícones
export type IconName =
  | "arrow"
  | "arrow-ne"
  | "arrow-down"
  | "close"
  | "check"
  | "whatsapp"
  | "instagram"
  | "mail"
  | "user"
  | "pin";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
} as const;

const ICONS: Record<IconName, React.ReactNode> = {
  arrow: <path d="M3 12h17M13 5l7 7-7 7" {...STROKE} />,
  "arrow-ne": <path d="M6 18 18 6M8 6h10v10" {...STROKE} />,
  "arrow-down": <path d="M12 3v17M5 13l7 7 7-7" {...STROKE} />,
  close: <path d="M5 5l14 14M19 5 5 19" {...STROKE} />,
  check: <path d="M4 12.5l5.5 5.5L20 7" {...STROKE} strokeWidth={2.5} />,
  whatsapp: (
    <path
      fill="currentColor"
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"
    />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M3.5 6l8.5 7 8.5-7" {...STROKE} />
    </>
  ),
  user: (
    <>
      <rect x="8" y="3.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M4 21v-5h16v5" {...STROKE} />
    </>
  ),
  pin: (
    <>
      <path d="M12 21 5.5 12.5V4h13v8.5z" {...STROKE} />
      <rect x="10" y="7" width="4" height="4" fill="currentColor" />
    </>
  ),
};

/** Ícone decorativo (aria-hidden). O rótulo acessível vem do texto do botão/link em volta. */
export function Icon({ name, className, ...rest }: { name: IconName } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg viewBox="0 0 24 24" data-icon={name} className={className} aria-hidden="true" focusable="false" {...rest}>
      {ICONS[name]}
    </svg>
  );
}

// ------------------------------------------------------------------ motivos
type MarkProps = { className?: string; style?: CSSProperties };

/** O acento em paralelogramo do Ó. Cor: `currentColor`. */
export function AccentMark({ className, style }: MarkProps) {
  return (
    <svg viewBox="0 0 156 97" className={className} style={style} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M70.5 0H156L85 97H0z" />
    </svg>
  );
}

/** O triângulo de play do Ó. Cor: `currentColor`. */
export function PlayMark({ className, style }: MarkProps) {
  return (
    <svg viewBox="0 0 137 162" className={className} style={style} aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M0 0l137 81L0 162z" />
    </svg>
  );
}

/**
 * Dois anéis entrelaçados — o "nó" de NÓS (conexão). O primeiro anel usa `currentColor`; o segundo,
 * `--ring-2` (padrão: a mesma cor). A folga do entrelace usa `--s-bg`, a cor de fundo do bloco.
 */
export function RingsMark({ className, style }: MarkProps) {
  const r = 42;
  const c = 2 * Math.PI * r;
  // arco do 1º anel que passa POR CIMA do 2º (em torno do cruzamento superior, a ~316° no sentido horário)
  const arc = (from: number, to: number) => ({
    strokeDasharray: `${(((to - from) / 360) * c).toFixed(2)} ${c.toFixed(2)}`,
    strokeDashoffset: (-(from / 360) * c).toFixed(2),
  });
  return (
    <svg viewBox="0 0 200 120" className={className} style={style} aria-hidden="true" focusable="false" fill="none">
      <circle cx="70" cy="60" r={r} stroke="currentColor" strokeWidth="13" />
      <circle cx="130" cy="60" r={r} stroke="var(--ring-2, currentColor)" strokeWidth="13" />
      <circle cx="70" cy="60" r={r} stroke="var(--s-bg, transparent)" strokeWidth="21" {...arc(296, 336)} />
      <circle cx="70" cy="60" r={r} stroke="currentColor" strokeWidth="13" {...arc(286, 346)} />
    </svg>
  );
}

/** Indicador de nível dos planos: `total` acentos, `level` deles acesos. */
export function LevelMark({ level, total, className }: { level: number; total: number; className?: string }) {
  const count = Math.min(Math.max(total, 1), 6);
  return (
    <svg
      viewBox={`0 0 ${29 * count - 1} 24`}
      className={cn("s-level", className)}
      role="img"
      aria-label={`Nível ${Math.min(level, count)} de ${count}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <path key={i} className={i < level ? "on" : undefined} d={`M${11 + 29 * i} 0h17L${17 + 29 * i} 24H${29 * i}z`} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- molduras
/**
 * Cantoneiras de visor. Elemento decorativo, posicionado em `absolute` dentro de um pai `relative`
 * (use a classe `s-framed` no pai ou qualquer bloco já posicionado). Cor: `currentColor` do pai;
 * ajuste por CSS com `--arm` (tamanho do braço), `--stroke` e `inset`.
 */
export function ViewfinderFrame({ className, style }: MarkProps) {
  return <span className={cn("s-frame", className)} style={style} aria-hidden="true" />;
}

/** Ponto REC — microdetalhe de câmera, decorativo. */
export function RecDot({ className }: { className?: string }) {
  return (
    <span className={cn("s-rec", className)} aria-hidden="true">
      REC
    </span>
  );
}

export type RatioKind = "play" | "accent" | "rings";
const RATIOS: Record<RatioKind, { ratio: string; label: string }> = {
  play: { ratio: "16 / 9", label: "16:9" }, // vídeo
  accent: { ratio: "9 / 16", label: "9:16" }, // tela de celular
  rings: { ratio: "4 / 5", label: "4:5" }, // retrato
};

/**
 * Enquadramento por proporção com um motivo da marca dentro: 16:9 + play (audiovisual), 9:16 + acento
 * (redes sociais), 4:5 + anéis (eventos e casamentos). Decorativo.
 */
export function RatioFrame({ kind, className }: { kind: RatioKind; className?: string }) {
  const { ratio, label } = RATIOS[kind];
  return (
    <span className={cn("s-ratio", className)} data-kind={kind} style={{ "--ratio": ratio } as CSSProperties} aria-hidden="true">
      <ViewfinderFrame />
      {kind === "accent" ? (
        <span className="s-ratio__bars">
          <i />
          <i />
          <i />
        </span>
      ) : null}
      {kind === "play" ? <PlayMark className="s-ratio__mark" /> : null}
      {kind === "accent" ? <AccentMark className="s-ratio__mark" /> : null}
      {kind === "rings" ? <RingsMark className="s-ratio__mark" /> : null}
      <span className="s-ratio__label">{label}</span>
    </span>
  );
}
