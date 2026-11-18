import "server-only";
import { consumeRateLimit, loginEmailKey, resetRateLimit, type RateLimitRule } from "./rate-limit";
import { anonymize } from "./tokens";

/**
 * Barreiras do login (limitador de tentativas). Separado da action para poder ser testado com o banco
 * (login-limits.db.test.ts).
 *
 * 1. Por IP (30 em 15 min) e por e-mail + IP (8 em 15 min): força bruta comum. Valem sempre.
 * 2. Por e-mail (40 em 1 h, somando todos os IPs): ataque distribuído contra UMA conta. Esta barreira poderia
 *    ser estourada de propósito por um estranho para trancar um sócio do lado de fora — por isso ela nunca
 *    recusa sozinha:
 *    - navegador que já entrou nessa conta ("aparelho conhecido", cookie assinado) nem conta nela;
 *    - para os demais, estourar o limite liga o "modo restrito" da conta por 1 hora: cada IP passa a ter só
 *      3 tentativas por hora para aquele e-mail. O dono, de um aparelho novo e com a senha certa, entra na
 *      primeira; quem está chutando senhas fica com 3 chutes por hora por IP (em vez de 32).
 *
 * Resultado: tentativas erradas de terceiros (de outros IPs) nunca fazem a senha CERTA do dono ser recusada.
 * O modo restrito termina sozinho em 1 hora, ou na hora com `unlockLogin()` (redefinição de senha concluída,
 * senha gerada por um administrador, `npm run user:create -- --unlock`).
 */
const MINUTE = 60 * 1000;

export const LOGIN_RULES = {
  ip: { limit: 30, windowMs: 15 * MINUTE },
  pair: { limit: 8, windowMs: 15 * MINUTE },
  email: { limit: 40, windowMs: 60 * MINUTE },
  /** e-mail + IP enquanto a conta está em modo restrito */
  strictPair: { limit: 3, windowMs: 60 * MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type LoginAttempt = {
  /** E-mail informado (já em minúsculas e sem espaços). */
  email: string;
  /** IP do visitante já agrupado por `rateLimitIp()` (IPv6 por /64). */
  ipBucket: string;
  /** O navegador apresentou o cookie de aparelho conhecido desta conta (`isKnownDevice`). */
  knownDevice: boolean;
};

export type LoginGate = { ok: true } | { ok: false; retryAfterSeconds: number; barrier: "ip" | "pair" | "account" };

const ipKey = (ipBucket: string) => `login:ip:${anonymize(ipBucket)}`;
const pairKey = (email: string, ipBucket: string) => `login:par:${anonymize(`${email}|${ipBucket}`)}`;
const strictPairKey = (email: string, ipBucket: string) => `login:par-restrito:${anonymize(`${email}|${ipBucket}`)}`;

/** Conta a tentativa e diz se ela pode seguir para a conferência da senha. */
export async function checkLoginAttempt({ email, ipBucket, knownDevice }: LoginAttempt): Promise<LoginGate> {
  const byIp = await consumeRateLimit(ipKey(ipBucket), LOGIN_RULES.ip);
  if (!byIp.ok) return { ok: false, retryAfterSeconds: byIp.retryAfterSeconds, barrier: "ip" };
  const byPair = await consumeRateLimit(pairKey(email, ipBucket), LOGIN_RULES.pair);
  if (!byPair.ok) return { ok: false, retryAfterSeconds: byPair.retryAfterSeconds, barrier: "pair" };
  if (knownDevice) return { ok: true };

  const byEmail = await consumeRateLimit(loginEmailKey(email), LOGIN_RULES.email);
  if (byEmail.ok) return { ok: true };
  // Conta em modo restrito: este IP ainda tem direito a poucas tentativas (a do dono com a senha certa passa).
  const strict = await consumeRateLimit(strictPairKey(email, ipBucket), LOGIN_RULES.strictPair);
  return strict.ok ? { ok: true } : { ok: false, retryAfterSeconds: strict.retryAfterSeconds, barrier: "account" };
}

/**
 * Login certo zera os contadores ligados à conta e a este IP: quem entra várias vezes ao dia não pode acabar
 * bloqueado. (O contador por IP continua: ele protege todas as contas.)
 */
export async function clearLoginAttempts(email: string, ipBucket: string): Promise<void> {
  await resetRateLimit(pairKey(email, ipBucket));
  await resetRateLimit(strictPairKey(email, ipBucket));
  await resetRateLimit(loginEmailKey(email));
}

/**
 * Mensagem para a tela de login. Na barreira da conta, aponta a saída imediata para o dono — quando o envio de
 * e-mail está configurado (`canResetByEmail`); sem ele, o caminho é um administrador gerar uma senha nova.
 */
export function loginGateMessage(gate: Extract<LoginGate, { ok: false }>, canResetByEmail: boolean): string {
  const minutes = Math.max(1, Math.ceil(gate.retryAfterSeconds / 60));
  const wait = minutes <= 1 ? "Aguarde um minuto e tente de novo" : `Tente de novo em ${minutes} minutos`;
  if (gate.barrier !== "account") return `Muitas tentativas. ${wait}.`;
  return canResetByEmail
    ? `Muitas tentativas de entrar nesta conta. ${wait} — ou use “Esqueci minha senha” para criar uma senha nova e entrar agora.`
    : `Muitas tentativas de entrar nesta conta. ${wait} — ou peça a um administrador para gerar uma senha nova em Configurações › Usuários.`;
}
