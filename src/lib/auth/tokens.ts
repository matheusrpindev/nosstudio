import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Token aleatório (256 bits) seguro para URL/cookie. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** O banco guarda apenas o SHA-256 do token: um vazamento do banco não entrega sessões válidas. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** HMAC curto para anonimizar identificadores (IP, e-mail) usados como chave do limitador de tentativas. */
export function anonymize(value: string): string {
  return createHmac("sha256", env.appSecret).update(value).digest("hex").slice(0, 32);
}

// ------------------------------------------------------------ aparelho conhecido
/**
 * Marca de "aparelho conhecido" de uma conta: HMAC do e-mail com o segredo da aplicação. Vai num cookie gravado
 * depois de um login certo (ou de uma redefinição de senha pelo link do e-mail). NÃO autentica ninguém: só
 * isenta aquele navegador do limite de tentativas POR E-MAIL, para que um ataque de senha contra a conta não
 * tranque o próprio dono do lado de fora. Os limites por IP continuam valendo.
 */
export function deviceToken(email: string): string {
  return anonymize(`aparelho|${email.trim().toLowerCase()}`);
}

const DEVICE_TOKEN_RE = /^[a-f0-9]{32}$/;
/** Quantas contas o mesmo navegador pode "lembrar" (os dois sócios no mesmo computador, por exemplo). */
const MAX_DEVICE_TOKENS = 4;

function parseDeviceCookie(value: string | null | undefined): string[] {
  if (!value || value.length > 400) return [];
  return value.split(".").filter((part) => DEVICE_TOKEN_RE.test(part)).slice(0, MAX_DEVICE_TOKENS);
}

/** O cookie traz a marca desta conta? (comparação em tempo constante) */
export function hasDeviceToken(cookieValue: string | null | undefined, token: string): boolean {
  const expected = Buffer.from(token);
  return parseDeviceCookie(cookieValue).some((part) => {
    const given = Buffer.from(part);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Novo valor do cookie com a marca desta conta à frente (sem repetir, no máximo `MAX_DEVICE_TOKENS`). */
export function withDeviceToken(cookieValue: string | null | undefined, token: string): string {
  return [token, ...parseDeviceCookie(cookieValue).filter((part) => part !== token)].slice(0, MAX_DEVICE_TOKENS).join(".");
}
