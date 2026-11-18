/** Rótulos curtos do tom de situação usados nas listas do editor do site. */
import type { BadgeTone } from "@/components/ui/badge";

export const PUBLISHED_TONES: Record<"publicado" | "rascunho", BadgeTone> = { publicado: "sucesso", rascunho: "neutral" };
export const PUBLISHED_LABELS = { publicado: "Publicado", rascunho: "Rascunho" } as const;
