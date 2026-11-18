"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { anonymize } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { getClientIp } from "@/lib/request";
import { LEAD_HONEYPOT_FIELD, LEAD_MIN_FILL_MS, LEAD_STARTED_AT_FIELD, leadFormSchema, type LeadSuccess } from "@/lib/site/lead-form";
import { parseForm } from "@/server/action";
import { getSetting } from "@/server/settings";
import { getSiteContent } from "@/server/site/queries";
import { createLead, leadNotificationEmail, leadWhatsAppUrl } from "./create-lead";

const MINUTE = 60 * 1000;

/**
 * Envio do formulário público de contato/orçamento. Não exige login (é a porta de entrada do site).
 * Proteções: campo-isca, tempo mínimo de preenchimento, limite por IP, validação e limites de tamanho.
 */
export async function submitLeadAction(_prev: ActionState<LeadSuccess>, formData: FormData): Promise<ActionState<LeadSuccess>> {
  const content = await getSiteContent();
  const success = (whatsappUrl: string | null) =>
    actionOk<LeadSuccess>(content.contactPage.successTitle, {
      title: content.contactPage.successTitle,
      text: content.contactPage.successText,
      whatsappUrl,
    });

  // Robôs: resposta de "sucesso" sem gravar nada (não damos pista de que foram detectados).
  const honeypot = formData.get(LEAD_HONEYPOT_FIELD);
  const startedAt = Number(formData.get(LEAD_STARTED_AT_FIELD));
  const tooFast = Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < LEAD_MIN_FILL_MS;
  if ((typeof honeypot === "string" && honeypot.trim() !== "") || tooFast) return success(null);

  const parsed = parseForm(leadFormSchema, formData);
  if (!parsed.ok) return parsed.state as ActionState<LeadSuccess>;

  const ip = anonymize(await getClientIp());
  for (const [key, rule] of [
    [`lead:ip:${ip}`, { limit: 5, windowMs: 10 * MINUTE }],
    [`lead:dia:${ip}`, { limit: 20, windowMs: 24 * 60 * MINUTE }],
  ] as const) {
    const result = await consumeRateLimit(key, rule);
    if (!result.ok) {
      return actionError<LeadSuccess>(
        "Recebemos muitos envios em sequência. Aguarde alguns minutos e tente de novo — ou chame a gente no WhatsApp.",
        { values: Object.fromEntries([...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string")) },
      );
    }
  }

  const lead = await createLead(parsed.data, content.privacyPage.version);

  // Aviso por e-mail aos sócios, depois da resposta ao visitante (o lead já está salvo; falha aqui não o perde).
  after(async () => {
    try {
      const settings = await getSetting("notifications");
      if (!settings.notifyOnLead) return;
      const recipients =
        settings.leadEmails.length > 0
          ? settings.leadEmails
          : (await db.select({ email: users.email }).from(users).where(eq(users.active, true))).map((user) => user.email);
      if (recipients.length === 0) return;
      const { subject, text } = leadNotificationEmail(lead, `${env.siteUrl}/painel/leads/${lead.id}`);
      await sendMail({ to: recipients, subject, text });
    } catch (error) {
      console.error("[leads] falha ao notificar novo lead", error);
    }
  });

  return success(leadWhatsAppUrl(content.general.whatsapp, parsed.data));
}
