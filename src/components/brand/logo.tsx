import { cn } from "@/lib/cn";
import { LOGO_SHAPES, type LogoVariant } from "./logo-data";

export type LogoTone = "roxo" | "branco" | "grafite";

const TONES: Record<LogoTone, { letters: string; accent: string; text: string; frame: string }> = {
  /** Versão principal, para fundos claros. */
  roxo: { letters: "#3B1F8E", accent: "#C6F432", text: "#5F5F5F", frame: "#CFC6FF" },
  /** Para fundos escuros (roxo, grafite). */
  branco: { letters: "#FFFFFF", accent: "#C6F432", text: "#FFFFFF", frame: "#CFC6FF" },
  /** Monocromática, para fundo lima ou impressão. */
  grafite: { letters: "#1B1B22", accent: "#1B1B22", text: "#1B1B22", frame: "#CFC6FF" },
};

type LogoProps = {
  /**
   * - `completo`: visor + NÓS + STUDIO + assinatura (como no arquivo da marca; use em tamanhos grandes)
   * - `assinatura`: visor + NÓS + STUDIO
   * - `wordmark`: só NÓS (cabeçalhos e tamanhos pequenos)
   * - `simbolo`: o Ó com o play (ícones, avatares)
   */
  variant?: LogoVariant;
  tone?: LogoTone;
  /** Texto alternativo. Passe `""` quando o logo for decorativo (já há o nome da marca ao lado). */
  label?: string;
  className?: string;
};

/**
 * Logo oficial da NÓS Studio em SVG inline. Defina o tamanho pela altura ou largura via className
 * (ex.: `className="h-8 w-auto"`); a proporção é preservada. Não distorça nem recolora fora dos tons previstos.
 */
export function Logo({ variant = "wordmark", tone = "roxo", label = "NÓS Studio", className }: LogoProps) {
  const shape = LOGO_SHAPES[variant];
  const colors = TONES[tone];
  const decorative = label === "";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${shape.width} ${shape.height}`}
      className={cn("block h-8 w-auto shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      {shape.frame ? (
        <path d={shape.frame} fill="none" stroke={colors.frame} strokeWidth={shape.frameStroke} strokeLinecap="round" />
      ) : null}
      <path d={shape.letters} fill={colors.letters} fillRule="evenodd" />
      <path d={shape.accent} fill={colors.accent} />
      {shape.studio || shape.tagline ? (
        <path d={`${shape.studio}${shape.tagline}`} fill={colors.text} fillRule="evenodd" />
      ) : null}
    </svg>
  );
}
