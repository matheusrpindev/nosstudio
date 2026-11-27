"use server";

import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { anonymize } from "@/lib/auth/tokens";
import { rateLimitIp } from "@/lib/client-ip";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { getClientIp } from "@/lib/request";
import { buildLeadRecord, leadFormSchema } from "@/lib/site/lead-form";
import { knownPackageName, leadSpamSignals, type LeadSuccess } from "@/lib/site/lead-form-fields";
import { parseForm } from "@/server/action";
import { getSetting } from "@/server/settings";
import { getLeadOriginNames, getSiteContent } from "@/server/site/queries";
import { createLead, leadNotificationEmail, leadWhatsAppUrl } from "./create-lead";

const MINUTE = 60 * 1000;

/**
 * Envio do formulário público de contato/orçamento. Não exige login (é a porta de entrada do site).
 * Proteções: campo-isca, validação e limites de tamanho, limite por IP. Envio rápido demais NÃO é descartado
 * (uma pessoa com preenchimento automático consegue ser rápida): é gravado e sinalizado na ficha do lead.
 */
export async function submitLeadAction(_prev: ActionState<LeadSuccess>, formData: FormData): Promise<ActionState<LeadSuccess>> {
  const content = await getSiteContent();
  const success = (whatsappUrl: string | null) =>
    actionOk<LeadSuccess>(content.contactPage.successTitle, {
      title: content.contactPage.successTitle,
      text: content.contactPage.successText,
      whatsappUrl,
    });

  // Campo-isca preenchido = robô: resposta de "sucesso" sem gravar nada (não damos pista de que foi detectado).
  const signals = leadSpamSignals(formData, Date.now());
  if (signals.honeypot) return success(null);

  // Validação ANTES de qualquer outra decisão: quem errou um campo (ou enviou vazio) sempre vê os erros.
  const parsed = parseForm(leadFormSchema, formData);
  if (!parsed.ok) return parsed.state as ActionState<LeadSuccess>;

  const ip = anonymize(rateLimitIp(await getClientIp()));
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

  // "Plano/serviço de origem" só é gravado se for o nome de um plano, avulso ou serviço publicado (o campo vem da
  // URL: ?pacote=…).
  const packageName = knownPackageName(parsed.data.packageName, await getLeadOriginNames());

  const lead = await createLead({ ...parsed.data, packageName }, content.privacyPage.version, { tooFast: signals.tooFast });

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

  // no formulário de evento o interesse vem do tipo de evento (ver `buildLeadRecord`)
  const record = buildLeadRecord(parsed.data);
  return success(leadWhatsAppUrl(content.general.whatsapp, { name: parsed.data.name, ...record }));
}
