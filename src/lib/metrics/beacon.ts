/**
 * O "sinal" que o navegador manda para /api/visita: o mínimo para contar uma visita, e nada que identifique a
 * pessoa. Chaves curtas porque viaja em toda página. Validado no servidor com este schema (zod).
 *
 *   { t: "p", p: "/servicos", r: "instagram.com", w: 390, us, um, uc }   página vista
 *   { t: "e", p: "/contato", e: "whatsapp:flutuante" }                   clique medido
 */
import { z } from "zod";

/** Tamanho máximo do corpo aceito pela rota, em bytes. */
export const BEACON_MAX_BYTES = 1024;
export const BEACON_PATH = "/api/visita";

const short = (max: number) => z.string().max(max).optional();

export const beaconSchema = z
  .object({
    /** p = página vista; e = clique medido. */
    t: z.enum(["p", "e"]),
    /** Caminho da página (sem domínio). */
    p: z.string().min(1).max(300).startsWith("/"),
    /** Só o DOMÍNIO de onde a pessoa veio (nunca a URL inteira). */
    r: short(120),
    /** Largura da tela em pixels. */
    w: z.number().int().min(0).max(20_000).optional(),
    us: short(120),
    um: short(120),
    uc: short(120),
    /** Evento: `<tipo>:<alvo>`. */
    e: short(64),
  })
  .strict()
  .refine((data) => data.t !== "e" || Boolean(data.e), { path: ["e"], message: "evento sem alvo" });

export type Beacon = z.infer<typeof beaconSchema>;

/** Lê o corpo (texto JSON) do sinal. `null` = malformado. */
export function parseBeacon(body: string): Beacon | null {
  if (!body || body.length > BEACON_MAX_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = beaconSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
