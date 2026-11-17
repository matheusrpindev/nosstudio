import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, smtpConfigured } from "@/lib/env";

export type MailInput = { to: string | string[]; subject: string; text: string; html?: string; replyTo?: string };
export type MailResult = { delivered: boolean; reason?: string };

let transporter: Transporter | null = null;

/**
 * Envia um e-mail transacional via SMTP (qualquer provedor). Sem SMTP configurado, o conteúdo é apenas
 * registrado no log do servidor — útil em desenvolvimento e como plano B documentado no README.
 * Nunca lança erro: quem chama decide o que fazer com `delivered: false`.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!smtpConfigured()) {
    console.info(
      `\n[e-mail não enviado — SMTP não configurado]\nPara: ${[input.to].flat().join(", ")}\nAssunto: ${input.subject}\n\n${input.text}\n`,
    );
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
    console.error("[mail] falha no envio", error);
    return { delivered: false, reason: "send_failed" };
  }
}
