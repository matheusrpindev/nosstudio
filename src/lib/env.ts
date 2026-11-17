/**
 * Variáveis de ambiente (lidas só no servidor). Veja .env.example.
 */
const isProd = process.env.NODE_ENV === "production";

function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProd) {
    throw new Error(
      "APP_SECRET não configurado (mínimo 32 caracteres). Gere um com: openssl rand -base64 48",
    );
  }
  return "dev-only-secret-nao-usar-em-producao-0000000000";
}

export const env = {
  isProd,
  /** URL pública do site, sem barra no final. Usada em links de e-mail, sitemap, Open Graph. */
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  /** Fuso horário do estúdio (agenda, "hoje", janelas da barra de avisos). */
  timezone: process.env.APP_TIMEZONE || "America/Sao_Paulo",
  /** Pasta onde os uploads são gravados (precisa ser persistente em produção). */
  uploadDir: process.env.UPLOAD_DIR || "./data/uploads",
  /** Segredo para HMAC (ex.: anonimizar IPs no limitador de tentativas). Avaliado sob demanda. */
  get appSecret() {
    return appSecret();
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    /** Remetente, ex.: "NÓS Studio <contato@seudominio.com.br>" */
    from: process.env.MAIL_FROM || "",
  },
  /** Quantos proxies confiáveis existem na frente do app (para ler o IP real em X-Forwarded-For). */
  trustedProxies: Number(process.env.TRUSTED_PROXIES || 1),
};

export const smtpConfigured = () => Boolean(env.smtp.host && env.smtp.from);
