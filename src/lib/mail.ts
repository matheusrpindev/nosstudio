import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, smtpConfigured } from "@/lib/env";

export type MailInput = { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string };
export type MailResult = { delivered: boolean; reason?: string };

let transporter: Transporter | null = null;

/** "pe***@dominio.com.br": o bastante para saber para quem era, sem gravar o endereço inteiro no log. */
function maskEmail(address: string): string {
  const [local, domain] = address.split("@");
  return domain ? `${local.slice(0, 2)}***@${domain}` : "***";
}

/**
 * O que vai para o log quando não há SMTP. Em PRODUÇÃO, só uma linha sem conteúdo: o corpo pode trazer o link
 * de redefinição de senha (um token válido) ou os dados pessoais de um lead, e log de servidor não é lugar para
 * nenhum dos dois. O texto completo só aparece em desenvolvimento, para testar os fluxos sem servidor de e-mail.
 */
export function unsentMailLog(input: MailInput, isProd: boolean): string {
  const recipients = [input.to].flat();
  if (isProd) {
    const subject = input.subject.split(":")[0].replace(/[\r\n]+/g, " ").slice(0, 60);
    return `[e-mail não enviado — SMTP não configurado] Para: ${recipients.map(maskEmail).join(", ")} · Assunto: ${subject}`;
  }
  return `\n[e-mail não enviado — SMTP não configurado]\nPara: ${recipients.join(", ")}\nAssunto: ${input.subject}\n\n${input.text}\n`;
}

/**
 * Envia um e-mail transacional via SMTP (qualquer provedor). Sem SMTP configurado, nada é enviado: em
 * desenvolvimento o conteúdo vai para o log do servidor; em produção, só um aviso de uma linha (sem o texto).
 * Nunca lança erro: quem chama decide o que fazer com `delivered: false`.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!smtpConfigured()) {
    console.info(unsentMailLog(input, env.isProd));
    return { delivered: false, reason: "smtp_not_configured" };
  }
  try {
    transporter ??= nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
    await transporter.sendMail({ from: env.smtp.from, ...input });
    return { delivered: true };
  } catch (error) {
    // só a mensagem do erro: o objeto completo pode trazer o envelope (endereços) e a resposta do servidor
    console.error("[mail] falha no envio:", (error as Error)?.message ?? "erro desconhecido");
    return { delivered: false, reason: "send_failed" };
  }
}
