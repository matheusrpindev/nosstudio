"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { rateLimitIp } from "@/lib/client-ip";
import { env, smtpConfigured } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { getClientIp, getUserAgent } from "@/lib/request";
import { FORCE_PASSWORD_PATH, LOGIN_PATH, PANEL_HOME, requireUser, safeNextPath } from "./index";
import { hashPassword, passwordProblem, verifyAgainstDummy, verifyPassword } from "./password";
import { checkLoginAttempt, clearLoginAttempts, loginGateMessage } from "./login-limits";
import { consumeRateLimit, retryMessage, unlockLogin } from "./rate-limit";
import { revokeResetTokens } from "./reset-tokens";
import { createSession, destroyCurrentSession, destroyUserSessions, getSession, isKnownDevice, rememberDevice } from "./session";
import { anonymize, generateToken, hashToken } from "./tokens";

const MINUTE = 60 * 1000;
const RESET_TOKEN_LIFETIME = 60 * MINUTE;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// --------------------------------------------------------------------- login
export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const next = safeNextPath(field(formData, "next"));
  const values = { email };

  if (!EMAIL_RE.test(email) || !password) {
    return actionError("Informe seu e-mail e sua senha.", { values });
  }
  if (password.length > 200) return actionError("E-mail ou senha incorretos.", { values });

  const ip = await getClientIp();
  const ipBucket = rateLimitIp(ip);
  // Limitador de tentativas (regras e porquês em ./login-limits.ts). Tentativas erradas de terceiros nunca
  // fazem a senha certa do dono ser recusada: aparelho conhecido não entra na barreira da conta, e aparelho
  // novo mantém algumas tentativas por IP mesmo com a conta sob ataque.
  const gate = await checkLoginAttempt({ email, ipBucket, knownDevice: await isKnownDevice(email) });
  if (!gate.ok) return actionError(loginGateMessage(gate, smtpConfigured()), { values });

  const [user] = await db.select().from(users).where(eq(users.email, email));
  // Mesmo custo de tempo exista ou não a conta (evita descobrir e-mails cadastrados pelo tempo de resposta).
  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : await verifyAgainstDummy(password);

  if (!user || !passwordOk || !user.active) {
    await logAudit({ action: "login_falhou", entity: "user", entityId: user?.id, summary: "Tentativa de login recusada" });
    return actionError("E-mail ou senha incorretos.", { values });
  }

  await clearLoginAttempts(email, ipBucket);
  await createSession(user.id, { ip, userAgent: await getUserAgent() });
  await rememberDevice(email);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await logAudit({ user, action: "login", entity: "user", entityId: user.id, summary: "Entrou no painel" });

  redirect(user.mustChangePassword ? `${FORCE_PASSWORD_PATH}?obrigatoria=1` : next);
}

// -------------------------------------------------------------------- logout
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await destroyCurrentSession();
  if (session) {
    await logAudit({ user: session.user, action: "logout", entity: "user", entityId: session.user.id, summary: "Saiu do painel" });
  }
  redirect(LOGIN_PATH);
}

// ------------------------------------------------------ recuperação de senha
const RESET_GENERIC_MESSAGE =
  "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 1 hora — confira também o spam.";

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = field(formData, "email").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return actionError("Informe um e-mail válido.", { values: { email } });

  const ipBucket = rateLimitIp(await getClientIp());
  const ipLimit = await consumeRateLimit(`reset:ip:${anonymize(ipBucket)}`, { limit: 6, windowMs: 60 * MINUTE });
  if (!ipLimit.ok) return actionError(retryMessage(ipLimit.retryAfterSeconds), { values: { email } });
  // Limites por e-mail são silenciosos: a resposta é sempre a mesma, exista ou não a conta.
  // Por e-mail+IP (3/h): um estranho pedindo links para o e-mail de um sócio não gasta a cota do próprio sócio.
  // Por e-mail (8/h): teto de mensagens na caixa de entrada mesmo que os pedidos venham de vários IPs.
  const pairLimit = await consumeRateLimit(`reset:par:${anonymize(`${email}|${ipBucket}`)}`, { limit: 3, windowMs: 60 * MINUTE });
  // (o teto por e-mail não vale para um aparelho conhecido da conta: um estranho não consegue gastar a cota do dono)
  const emailLimit = await consumeRateLimit(`reset:email:${anonymize(email)}`, { limit: 8, windowMs: 60 * MINUTE });
  const allowed = pairLimit.ok && (emailLimit.ok || (await isKnownDevice(email)));

  // O link é criado e enviado DEPOIS da resposta: assim o tempo de resposta é o mesmo exista ou não a conta
  // (esperar o envio do e-mail só quando a conta existe entregaria, pelo relógio, quais e-mails têm acesso).
  if (allowed) {
    after(async () => {
      try {
        await sendPasswordResetLink(email);
      } catch (error) {
        console.error("[auth] falha ao enviar o link de redefinição de senha", (error as Error)?.message);
      }
    });
  }

  return actionOk(RESET_GENERIC_MESSAGE);
}

async function sendPasswordResetLink(email: string): Promise<void> {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.email, email), eq(users.active, true)));
  if (!user) return;

  const token = generateToken();
  await db.transaction(async (tx) => {
    // Um link válido por vez: pedidos anteriores deixam de funcionar.
    await revokeResetTokens(user.id, tx);
    await tx.insert(passwordResetTokens).values({
      id: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_LIFETIME),
    });
  });
  const link = `${env.siteUrl}/redefinir-senha?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Redefinição de senha — painel NÓS Studio",
    text: [
      `Olá, ${user.name.split(" ")[0]}!`,
      "",
      "Recebemos um pedido para redefinir a senha do seu acesso ao painel da NÓS Studio.",
      "Para criar uma nova senha, abra o link abaixo (válido por 1 hora):",
      "",
      link,
      "",
      "Se não foi você, é só ignorar este e-mail — sua senha continua a mesma.",
    ].join("\n"),
  });
  await logAudit({ user, action: "senha_reset_pedido", entity: "user", entityId: user.id, summary: "Pediu link de redefinição de senha" });
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = field(formData, "token");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  const ipBucket = rateLimitIp(await getClientIp());
  const limit = await consumeRateLimit(`reset-uso:ip:${anonymize(ipBucket)}`, { limit: 10, windowMs: 15 * MINUTE });
  if (!limit.ok) return actionError(retryMessage(limit.retryAfterSeconds));

  const problem = passwordProblem(password);
  if (problem) return actionError(problem, { fieldErrors: { password: problem } });
  if (password !== confirm) {
    return actionError("As senhas não conferem.", { fieldErrors: { confirm: "Repita a mesma senha." } });
  }

  const invalid = actionError("Este link é inválido ou já expirou. Peça um novo link de redefinição.");
  if (!token || token.length > 200) return invalid;

  const tokenId = hashToken(token);
  const [row] = await db
    .select({ userId: passwordResetTokens.userId, name: users.name, email: users.email })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.id, tokenId),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
        eq(users.active, true),
      ),
    );
  if (!row) return invalid;

  const passwordHash = await hashPassword(password);
  const consumed = await db.transaction(async (tx) => {
    // "Usar" o token primeiro e conferir que fomos nós: impede duas redefinições com o mesmo link.
    const used = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });
    if (used.length !== 1) return false;
    await tx.update(users).set({ passwordHash, mustChangePassword: false }).where(eq(users.id, row.userId));
    return true;
  });
  if (!consumed) return invalid;

  // Qualquer sessão aberta com a senha antiga é encerrada.
  await destroyUserSessions(row.userId);
  // Quem abriu o link provou que controla o e-mail da conta: o login dela é destravado (um estranho pode ter
  // estourado o limite de tentativas de propósito) e este navegador passa a ser um aparelho conhecido.
  await unlockLogin(row.email);
  await clearLoginAttempts(row.email, ipBucket);
  await rememberDevice(row.email);
  await logAudit({
    user: { id: row.userId, name: row.name },
    action: "senha_redefinida",
    entity: "user",
    entityId: row.userId,
    summary: "Redefiniu a senha pelo link enviado por e-mail",
  });
  redirect(`${LOGIN_PATH}?aviso=senha-redefinida`);
}

// ------------------------------------------------- troca de senha (logado)
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = await requireUser({ allowPasswordChange: true });
  const session = await getSession();
  const currentPassword = field(formData, "currentPassword");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  const limit = await consumeRateLimit(`troca-senha:user:${current.id}`, { limit: 10, windowMs: 15 * MINUTE });
  if (!limit.ok) return actionError(retryMessage(limit.retryAfterSeconds));

  const [user] = await db.select().from(users).where(eq(users.id, current.id));
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    return actionError("A senha atual não confere.", { fieldErrors: { currentPassword: "Senha atual incorreta." } });
  }
  const problem = passwordProblem(password);
  if (problem) return actionError(problem, { fieldErrors: { password: problem } });
  if (password !== confirm) {
    return actionError("As senhas não conferem.", { fieldErrors: { confirm: "Repita a mesma senha." } });
  }
  if (password === currentPassword) {
    return actionError("A nova senha precisa ser diferente da atual.", { fieldErrors: { password: "Escolha outra senha." } });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), mustChangePassword: false })
    .where(eq(users.id, user.id));
  // Mantém só a sessão atual; os outros aparelhos precisam entrar de novo.
  await destroyUserSessions(user.id, session?.sessionId);
  // Um link de redefinição pedido antes da troca deixa de valer (senão a troca não encerraria um incidente).
  await revokeResetTokens(user.id);
  await logAudit({ user, action: "senha_alterada", entity: "user", entityId: user.id, summary: "Alterou a própria senha" });

  if (current.mustChangePassword) redirect(PANEL_HOME);
  return actionOk("Senha alterada. Os outros aparelhos conectados foram desconectados.");
}
