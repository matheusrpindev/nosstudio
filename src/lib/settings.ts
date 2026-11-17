/**
 * Configurações INTERNAS do painel (tabela `settings`). Nunca aparecem no site público.
 * Arquivo puro; leitura/gravação no servidor em src/server/settings.ts.
 */
import { z } from "zod";

const proposal = z.object({
  /** Validade padrão de uma proposta nova, em dias. */
  validityDays: z.number().int().min(1).max(365),
  /** Entrada padrão (%). */
  entryPercent: z.number().min(0).max(100),
  /** Apresentação breve da NÓS (página 2 do PDF). */
  aboutText: z.string().trim().max(3000),
  /** Condições de pagamento padrão (texto livre). */
  paymentNotes: z.string().trim().max(3000),
  /** Observações e condições comerciais padrão. */
  conditions: z.string().trim().max(6000),
  /** Premissas do cálculo interno. */
  taxPercent: z.number().min(0).max(100),
  targetMarginPercent: z.number().min(0).max(100),
});

const finance = z.object({
  /** Reserva de caixa atual, definida manualmente pelos sócios (centavos). */
  cashReserveCents: z.number().int().min(0),
  /** Meta de reserva (centavos). 0 = sem meta. */
  cashReserveGoalCents: z.number().int().min(0),
  note: z.string().trim().max(1000),
});

const notifications = z.object({
  /** Avisar por e-mail quando chegar um lead pelo site (requer SMTP configurado). */
  notifyOnLead: z.boolean(),
  /** Destinatários do aviso. Vazio = todos os usuários ativos do painel. */
  leadEmails: z.array(z.string().trim().toLowerCase().max(160)).max(10),
});

export const settingsSchemas = { proposal, finance, notifications } as const;
export type SettingsKey = keyof typeof settingsSchemas;
export const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[];
export type Settings = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };

export const defaultSettings: Settings = {
  proposal: {
    validityDays: 15,
    entryPercent: 30,
    aboutText: [
      "A NÓS Studio nasceu da conexão entre duas pessoas: Pedro Henrique e Laura Nepomuceno. Dois olhares e uma vontade em comum: transformar criatividade, comunicação e audiovisual em histórias bem contadas.",
      "Unimos estratégia, conteúdo e produção audiovisual para aproximar pessoas, marcas e momentos. Cada projeto começa com uma conversa — e é construído junto, do primeiro contato à entrega.",
    ].join("\n\n"),
    paymentNotes: "",
    conditions: "",
    taxPercent: 0,
    targetMarginPercent: 0,
  },
  finance: { cashReserveCents: 0, cashReserveGoalCents: 0, note: "" },
  notifications: { notifyOnLead: true, leadEmails: [] },
};

export function resolveSetting<K extends SettingsKey>(key: K, stored: unknown): Settings[K] {
  const fallback = defaultSettings[key];
  if (stored === undefined || stored === null || typeof stored !== "object") return fallback;
  const parsed = settingsSchemas[key].safeParse({ ...fallback, ...(stored as object) });
  return parsed.success ? (parsed.data as Settings[K]) : fallback;
}
