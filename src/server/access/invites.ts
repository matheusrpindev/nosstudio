/**
 * CONVITES — a única porta de entrada de contas novas fora de Configurações › Usuários. Não existe cadastro
 * público: sem um convite válido (pendente, dentro da validade, para aquele e-mail) nenhuma conta é criada.
 *
 * Como nos links de redefinição de senha: o banco guarda só o SHA-256 do token; o token aparece UMA vez (no
 * retorno de `createInvite`, para montar o link do e-mail) e nunca vai para log ou auditoria.
 *
 * Este arquivo decide, grava, limita tentativas e audita. As Server Actions (./invite-actions.ts) só leem o
 * formulário, identificam quem chama e traduzem o resultado. Telas: Configurações › Usuários (lista, convidar,
 * revogar, convidar de novo), ficha do cliente ("Acessos do cliente") e `/convite` (aceite).
 */
import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, clientUsers, projectMembers, projects, userInvites, users, type UserInvite } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { consumeRateLimit, retryMessage } from "@/lib/auth/rate-limit";
import { anonymize, generateToken, hashToken } from "@/lib/auth/tokens";
import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/domain";
import { env } from "@/lib/env";
import { isValidEmail } from "@/lib/format";
import { sendMail, type MailResult } from "@/lib/mail";
import { canEverywhere, ENVIRONMENT_LABELS, environmentsOf, hasEnvironment, type PermissionOverrides } from "@/lib/permissions";

const MINUTE = 60 * 1000;
/** Validade do convite. */
export const INVITE_LIFETIME_MS = 7 * 24 * 60 * MINUTE;
/** Quem convida: no máximo 30 convites por hora (um convite dispara um e-mail para terceiros). */
const CREATE_LIMIT = { limit: 30, windowMs: 60 * MINUTE };
/** Quem aceita: 10 tentativas a cada 15 minutos por IP — o mesmo limite do uso do link de redefinição de senha. */
const ACCEPT_LIMIT = { limit: 10, windowMs: 15 * MINUTE };

export const INVITE_INVALID_MESSAGE = "Este convite é inválido ou já expirou. Peça um novo convite à NÓS Studio.";

/** Quem cria ou revoga convites. A permissão é conferida de novo aqui, além da Server Action. */
export type InviteActor = { id: number; name: string; role: UserRole; permissions?: PermissionOverrides | null };

// -------------------------------------------------------------------- estado
export type InviteStatus = "pendente" | "aceito" | "revogado" | "expirado";

export function inviteStatus(invite: Pick<UserInvite, "acceptedAt" | "revokedAt" | "expiresAt">, now: Date = new Date()): InviteStatus {
  if (invite.acceptedAt) return "aceito";
  if (invite.revokedAt) return "revogado";
  return invite.expiresAt.getTime() > now.getTime() ? "pendente" : "expirado";
}

/** Convite como o painel enxerga: sem o hash do token. */
export type InviteRow = Omit<UserInvite, "tokenHash"> & { status: InviteStatus };

function toRow(invite: UserInvite, now: Date = new Date()): InviteRow {
  const { tokenHash: _tokenHash, ...rest } = invite;
  return { ...rest, status: inviteStatus(invite, now) };
}

export async function listInvites(): Promise<InviteRow[]> {
  const now = new Date();
  const rows = await db.select().from(userInvites).orderBy(desc(userInvites.createdAt), desc(userInvites.id));
  return rows.map((row) => toRow(row, now));
}

// --------------------------------------------------------------------- criar
const optionalId = z.number().int().positive().nullable().default(null);

export const inviteInputSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(160, "E-mail longo demais.")
      .refine((value) => isValidEmail(value), "E-mail inválido."),
    name: z.string().trim().max(120, "Máximo de 120 caracteres.").default(""),
    role: z.enum(USER_ROLES, { error: "Selecione o perfil." }),
    clientId: optionalId,
    projectId: optionalId,
    projectRole: z.string().trim().max(60, "Máximo de 60 caracteres.").default(""),
  })
  .superRefine((value, ctx) => {
    if (value.role === "cliente" && value.clientId === null) {
      ctx.addIssue({ code: "custom", path: ["clientId"], message: "Escolha o cliente a que esta conta ficará vinculada." });
    }
    if (value.role !== "cliente" && value.clientId !== null) {
      ctx.addIssue({ code: "custom", path: ["clientId"], message: "Só convites de perfil Cliente são vinculados a uma ficha de cliente." });
    }
    // projeto no convite = entrar como membro da equipe do projeto: só para quem trabalha por projeto
    if (value.projectId !== null && !hasEnvironment(value.role, "equipe")) {
      ctx.addIssue({ code: "custom", path: ["projectId"], message: "Só convites de funcionário ou freelancer incluem um projeto." });
    }
  });
export type InviteInput = z.input<typeof inviteInputSchema>;

export type CreateInviteResult =
  | { ok: true; invite: InviteRow; /** Token do link: aparece só aqui, uma vez. */ token: string }
  | { ok: false; error: "forbidden" | "invalid" | "email_taken" | "client_not_found" | "project_not_found" | "rate_limited"; message: string; fieldErrors?: Record<string, string> };

/**
 * Cria um convite. Regras:
 * - só quem gerencia usuários (admin, sócio) convida;
 * - o e-mail não pode já ter conta (para dar acesso a uma conta existente, vincule-a ao projeto/cliente);
 * - um convite pendente por e-mail: criar outro revoga o anterior (o link antigo deixa de funcionar).
 */
export async function createInvite(input: InviteInput, actor: InviteActor, now: Date = new Date()): Promise<CreateInviteResult> {
  if (!canEverywhere(actor, "usuarios", "editar")) return { ok: false, error: "forbidden", message: "Só administradores e sócios podem convidar pessoas." };
  const parsed = inviteInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".") || "_form"] ??= issue.message;
    return { ok: false, error: "invalid", message: "Confira os campos destacados.", fieldErrors };
  }
  const data = parsed.data;

  const limit = await consumeRateLimit(`convite:user:${actor.id}`, CREATE_LIMIT);
  if (!limit.ok) return { ok: false, error: "rate_limited", message: retryMessage(limit.retryAfterSeconds) };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  if (existing) return { ok: false, error: "email_taken", message: "Já existe uma conta com este e-mail.", fieldErrors: { email: "Já existe uma conta com este e-mail." } };
  if (data.clientId !== null) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, data.clientId));
    if (!client) return { ok: false, error: "client_not_found", message: "Este cliente não existe mais.", fieldErrors: { clientId: "Cliente não encontrado." } };
  }
  if (data.projectId !== null) {
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, data.projectId));
    if (!project) return { ok: false, error: "project_not_found", message: "Este projeto não existe mais.", fieldErrors: { projectId: "Projeto não encontrado." } };
  }

  const token = generateToken();
  const invite = await db.transaction(async (tx) => {
    await tx
      .update(userInvites)
      .set({ revokedAt: now, revokedBy: actor.id })
      .where(and(eq(userInvites.email, data.email), isNull(userInvites.acceptedAt), isNull(userInvites.revokedAt)));
    const [created] = await tx
      .insert(userInvites)
      .values({ ...data, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS), invitedBy: actor.id })
      .returning();
    return created;
  });
  // sem e-mail nem nome do convidado na auditoria: ela não é apagada quando a pessoa pede exclusão (LGPD)
  await logAudit({ user: actor, action: "convite_criado", entity: "user_invite", entityId: invite.id, summary: `Convidou uma pessoa com o perfil ${USER_ROLE_LABELS[invite.role]}` });
  return { ok: true, invite: toRow(invite, now), token };
}

/** Link que vai no e-mail (tela pública de aceite: `src/app/(auth)/convite`). */
export function inviteLink(token: string): string {
  return `${env.siteUrl}/convite?token=${token}`;
}

/** Envia o e-mail do convite. Separado de `createInvite` para os testes nunca dispararem e-mail. */
export async function sendInviteEmail(invite: Pick<UserInvite, "email" | "name" | "role">, token: string): Promise<MailResult> {
  const areas = environmentsOf(invite.role).map((environment) => ENVIRONMENT_LABELS[environment]);
  return sendMail({
    to: invite.email,
    subject: "Convite — NÓS Studio",
    text: [
      invite.name ? `Olá, ${invite.name.split(" ")[0]}!` : "Olá!",
      "",
      `A NÓS Studio convidou você para acessar a plataforma (${areas.join(" e ")}).`,
      "Para criar a sua senha e ativar o acesso, abra o link abaixo (válido por 7 dias):",
      "",
      inviteLink(token),
      "",
      "Se você não esperava este convite, é só ignorar este e-mail.",
    ].join("\n"),
  });
}

// -------------------------------------------------------------------- revogar
export type RevokeInviteResult = { ok: true; invite: InviteRow } | { ok: false; error: "forbidden" | "not_found" | "already_accepted" };

/** Revoga um convite ainda não aceito: o link deixa de funcionar na hora. Revogar duas vezes não é erro. */
export async function revokeInvite(id: number, actor: InviteActor, now: Date = new Date()): Promise<RevokeInviteResult> {
  if (!canEverywhere(actor, "usuarios", "editar")) return { ok: false, error: "forbidden" };
  const [current] = await db.select().from(userInvites).where(eq(userInvites.id, id));
  if (!current) return { ok: false, error: "not_found" };
  if (current.acceptedAt) return { ok: false, error: "already_accepted" };
  if (current.revokedAt) return { ok: true, invite: toRow(current, now) };
  const [revoked] = await db
    .update(userInvites)
    .set({ revokedAt: now, revokedBy: actor.id })
    .where(and(eq(userInvites.id, id), isNull(userInvites.acceptedAt)))
    .returning();
  if (!revoked) return { ok: false, error: "already_accepted" }; // aceito no meio do caminho
  await logAudit({ user: actor, action: "convite_revogado", entity: "user_invite", entityId: id, summary: `Revogou um convite de perfil ${USER_ROLE_LABELS[revoked.role]}` });
  return { ok: true, invite: toRow(revoked, now) };
}

// ------------------------------------------------------------- convidar de novo
/**
 * "Reenviar": o token antigo não existe mais em lugar nenhum (o banco só guarda o hash), então reenviar é criar
 * um convite NOVO com os mesmos dados — `createInvite` revoga o anterior e o link antigo deixa de funcionar.
 * Vale para convites pendentes, expirados ou revogados; convite já aceito não se reenvia (a conta existe).
 */
export async function recreateInvite(id: number, actor: InviteActor, now: Date = new Date()): Promise<CreateInviteResult | { ok: false; error: "not_found" | "already_accepted"; message: string }> {
  if (!canEverywhere(actor, "usuarios", "editar")) return { ok: false, error: "forbidden", message: "Só administradores e sócios podem convidar pessoas." };
  const [current] = await db.select().from(userInvites).where(eq(userInvites.id, id));
  if (!current) return { ok: false, error: "not_found", message: "Este convite não existe mais." };
  if (current.acceptedAt) return { ok: false, error: "already_accepted", message: "Este convite já foi aceito: a conta já existe." };
  return createInvite(
    { email: current.email, name: current.name, role: current.role, clientId: current.clientId, projectId: current.projectId, projectRole: current.projectRole },
    actor,
    now,
  );
}

// --------------------------------------------------------------------- aceitar
/** O que a tela de aceite pode mostrar a quem abriu o link: só o necessário para preencher o formulário. */
export type PendingInvite = { email: string; name: string; role: UserRole; expiresAt: Date };

async function findPending(token: unknown, now: Date): Promise<UserInvite | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const [row] = await db
    .select()
    .from(userInvites)
    .where(and(eq(userInvites.tokenHash, hashToken(token)), isNull(userInvites.acceptedAt), isNull(userInvites.revokedAt), gt(userInvites.expiresAt, now)));
  return row ?? null;
}

/** Convite pendente deste token, ou `null` (inválido, expirado, revogado e já usado respondem igual). */
export async function getPendingInvite(token: unknown, now: Date = new Date()): Promise<PendingInvite | null> {
  const invite = await findPending(token, now);
  return invite ? { email: invite.email, name: invite.name, role: invite.role, expiresAt: invite.expiresAt } : null;
}

export type AcceptInviteInput = { token: string; email: string; name: string; password: string };
export type AcceptInviteResult =
  | { ok: true; user: { id: number; name: string; email: string; role: UserRole } }
  | { ok: false; error: "rate_limited" | "invalid_name" | "weak_password" | "invalid" | "email_taken"; message: string };

/**
 * Aceita um convite: cria a conta com a senha escolhida (mesma política de senha do resto do sistema) e aplica
 * os vínculos do convite (ficha de cliente, projeto). NÃO abre sessão: a pessoa entra pelo login, que é a porta
 * única (limite de tentativas, destino por ambiente).
 *
 * Recusa — sempre com a mesma mensagem — token desconhecido, convite expirado, revogado, já usado, ou e-mail
 * diferente do convidado. O convite é "gasto" dentro da transação, antes de criar a conta: dois envios
 * simultâneos do mesmo link criam uma conta só.
 */
export async function acceptInvite(input: AcceptInviteInput, context: { ipBucket: string }, now: Date = new Date()): Promise<AcceptInviteResult> {
  const limit = await consumeRateLimit(`convite-uso:ip:${anonymize(context.ipBucket)}`, ACCEPT_LIMIT);
  if (!limit.ok) return { ok: false, error: "rate_limited", message: retryMessage(limit.retryAfterSeconds) };

  const invalid = { ok: false, error: "invalid", message: INVITE_INVALID_MESSAGE } as const;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!name || name.length > 120) return { ok: false, error: "invalid_name", message: "Informe o seu nome." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: "weak_password", message: problem };

  const invite = await findPending(input.token, now);
  // e-mail diferente do convidado: mesma resposta de um convite inexistente (o link não serve para outra pessoa)
  if (!invite || invite.email !== email) return invalid;

  const emailTaken = { ok: false, error: "email_taken", message: "Já existe uma conta com este e-mail. Entre com ela ou use “Esqueci minha senha”." } as const;
  const [alreadyThere] = await db.select({ id: users.id }).from(users).where(eq(users.email, invite.email));
  if (alreadyThere) return emailTaken;

  const passwordHash = await hashPassword(password);
  type Outcome = { kind: "ok"; user: { id: number; name: string; email: string; role: UserRole } } | { kind: "invalid" } | { kind: "email_taken" };
  // (dois aceites no mesmo instante: o segundo espera a trava de escrita — src/db/busy.ts — e já encontra o convite gasto)
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    // "Gasta" o convite primeiro e confere que fomos nós (e que ele continua pendente neste instante).
    const used = await tx
      .update(userInvites)
      .set({ acceptedAt: now })
      .where(and(eq(userInvites.id, invite.id), isNull(userInvites.acceptedAt), isNull(userInvites.revokedAt), gt(userInvites.expiresAt, now)))
      .returning({ id: userInvites.id });
    if (used.length !== 1) return { kind: "invalid" };
    // (e-mail repetido aqui = conta criada por outro caminho neste instante: o índice único recusa, a
    // transação é desfeita e o convite continua pendente — tratado no catch abaixo)
    const [created] = await tx
      .insert(users)
      .values({ name, email: invite.email, role: invite.role, passwordHash, mustChangePassword: false, active: true })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
    await tx.update(userInvites).set({ acceptedUserId: created.id }).where(eq(userInvites.id, invite.id));
    if (invite.role === "cliente" && invite.clientId !== null) {
      await tx.insert(clientUsers).values({ clientId: invite.clientId, userId: created.id, addedBy: invite.invitedBy });
    }
    if (invite.projectId !== null && hasEnvironment(invite.role, "equipe")) {
      // entra só podendo VER o projeto; o que mais a pessoa pode (editar, baixar, enviar) é ajustado no painel
      await tx.insert(projectMembers).values({ projectId: invite.projectId, userId: created.id, role: invite.projectRole, canView: true, addedBy: invite.invitedBy });
    }
    return { kind: "ok", user: created };
  }).catch(async (error): Promise<Outcome> => {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, invite.email));
    if (taken) return { kind: "email_taken" };
    throw error;
  });

  if (outcome.kind === "invalid") return invalid;
  if (outcome.kind === "email_taken") return emailTaken;
  await logAudit({ user: outcome.user, action: "convite_aceito", entity: "user_invite", entityId: invite.id, summary: `Aceitou o convite e criou a conta (${USER_ROLE_LABELS[outcome.user.role]})` });
  return { ok: true, user: outcome.user };
}
