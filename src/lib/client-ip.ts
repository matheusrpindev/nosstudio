/**
 * IP do visitante a partir dos cabeçalhos de proxy — funções puras (testadas em client-ip.test.ts).
 *
 * O valor só é confiável quando o app está ATRÁS de um proxy que acrescenta/sobrescreve o X-Forwarded-For
 * (ver README, "Publicação"). Aqui garantimos o resto: o valor escolhido tem de ser um IP de verdade (texto
 * arbitrário cai todo no mesmo balde) e endereços IPv6 são agrupados por /64 no limitador de tentativas (uma
 * única máquina recebe um /64 inteiro e trocaria de endereço a cada requisição).
 */
import { isIP } from "node:net";

/** Balde único para "não deu para saber o IP" (cabeçalho ausente ou inválido). */
export const UNKNOWN_IP = "0.0.0.0";

/** Valida e normaliza um endereço vindo de cabeçalho: sem porta, sem colchetes, sem zona; IPv6 em minúsculas. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (value.length > 100) return null;
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(value); // [2001:db8::1]:443
  if (bracketed) value = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/.test(value)) value = value.slice(0, value.lastIndexOf(":")); // 203.0.113.7:51234
  value = value.replace(/%.*$/, ""); // zona de link-local (fe80::1%eth0)
  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6) return null;
  value = value.toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value); // IPv4 mapeado em IPv6
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(value); // o mesmo, escrito em hexadecimal
  if (mappedHex) {
    const [high, low] = [parseInt(mappedHex[1], 16), parseInt(mappedHex[2], 16)];
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return value;
}

/**
 * Escolhe o IP do cliente. `trustedProxies` = quantos proxies confiáveis existem na frente do app: cada um
 * acrescenta ao FINAL da lista o endereço de quem falou com ele, então o cliente real é o item
 * `tamanho - trustedProxies` (tudo antes disso foi enviado pelo próprio cliente e não é confiável).
 */
export function resolveClientIp(forwardedFor: string | null | undefined, realIp: string | null | undefined, trustedProxies: number): string {
  const hops = Number.isFinite(trustedProxies) ? Math.max(1, Math.floor(trustedProxies)) : 1;
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return normalizeIp(parts[Math.max(0, parts.length - hops)]) ?? UNKNOWN_IP;
  }
  return normalizeIp(realIp) ?? UNKNOWN_IP;
}

/** Os 4 primeiros grupos (o /64) de um IPv6 já validado, por extenso. */
function ipv6Prefix64(ip: string): string {
  const [head, tail = ""] = ip.split("::");
  const toGroups = (part: string) =>
    part
      .split(":")
      .filter(Boolean)
      // um IPv4 embutido no final (ex.: 64:ff9b::192.0.2.1) ocupa dois grupos
      .flatMap((group) => (group.includes(".") ? ["0", "0"] : [group]));
  const headGroups = toGroups(head);
  const tailGroups = ip.includes("::") ? toGroups(tail) : [];
  const zeros = Array<string>(Math.max(0, 8 - headGroups.length - tailGroups.length)).fill("0");
  return [...headGroups, ...zeros, ...tailGroups]
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":");
}

/** Identificador do visitante para o limitador de tentativas: o IPv4 inteiro ou o prefixo /64 do IPv6. */
export function rateLimitIp(ip: string): string {
  return isIP(ip) === 6 ? `${ipv6Prefix64(ip)}::/64` : ip;
}
