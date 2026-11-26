import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const SIZES = { sm: "size-7 text-[0.6875rem]", md: "size-9 text-xs", lg: "size-12 text-base" } as const;
const TONES = { lavanda: "bg-lavanda text-roxo-noite", roxo: "bg-roxo ring-detalhe-medio text-white ring-1", lima: "bg-lima text-grafite" } as const;

type AvatarProps = {
  /** Nome completo: as iniciais saem dele (`Pedro Henrique` → PH). */
  name: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  /** Por padrão é decorativo (o nome costuma estar ao lado). Passe `true` quando o avatar aparece sozinho. */
  labelled?: boolean;
  className?: string;
};

/** Círculo com as iniciais da pessoa. */
export function Avatar({ name, size = "md", tone = "lavanda", labelled, className }: AvatarProps) {
  return (
    <span
      {...(labelled ? { role: "img", "aria-label": name, title: name } : { "aria-hidden": true })}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide select-none", SIZES[size], TONES[tone], className)}
    >
      {initials(name) || "?"}
    </span>
  );
}
