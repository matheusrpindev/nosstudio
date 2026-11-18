import type { CSSProperties } from "react";

/**
 * Prévia da barra de avisos com as cores escolhidas. É uma aproximação fiel da barra do site
 * (texto centralizado, link sublinhado), não a barra em si — o fechar ("×") só aparece se `dismissible`.
 */
export function AnnouncementPreview({
  message,
  linkLabel,
  bg,
  fg,
  dismissible,
  className,
}: {
  message: string;
  linkLabel?: string | null;
  bg: string;
  fg: string;
  dismissible?: boolean;
  className?: string;
}) {
  const style: CSSProperties = { backgroundColor: bg, color: fg };
  return (
    <div className={`flex min-h-11 items-center gap-3 rounded-campo border border-grafite/10 px-4 py-2.5 text-sm leading-snug ${className ?? ""}`} style={style}>
      <p className="min-w-0 flex-1 text-center break-words">
        {message || <span className="opacity-70">Escreva a mensagem para ver a prévia.</span>}
        {message && linkLabel ? <span className="ml-2 font-bold underline underline-offset-2">{linkLabel}</span> : null}
      </p>
      {dismissible ? (
        <span aria-hidden="true" className="shrink-0 text-lg leading-none opacity-80">
          ×
        </span>
      ) : null}
    </div>
  );
}
