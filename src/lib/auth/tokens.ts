import { createHash, createHmac, randomBytes } from "node:crypto";
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
