/**
 * Apoio aos testes de permissão: cria contas de qualquer perfil com uma sessão válida no banco de teste.
 *
 * Para "logar" como uma conta num teste, o arquivo de teste simula o cookie (o `vi.mock` precisa ficar no
 * próprio arquivo de teste, antes dos imports):
 *
 *   const browser = vi.hoisted(() => ({ token: null as string | null }));
 *   vi.mock("next/headers", () => ({
 *     cookies: async () => ({ get: (name: string) => (browser.token && name.endsWith("nos_session") ? { name, value: browser.token } : undefined) }),
 *     headers: async () => new Headers(),
 *   }));
 *   vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
 *   vi.mock("next/navigation", () => ({
 *     redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
 *     notFound: () => { throw new Error("NOT_FOUND"); },
 *   }));
 *
 * e depois `browser.token = conta.token` (ou `null` para "sem sessão").
 */
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import type { UserRole } from "@/lib/domain";
import type { PermissionOverrides } from "@/lib/permissions";

export type TestAccount = { id: number; name: string; email: string; role: UserRole; token: string; permissions: PermissionOverrides };

const createdIds: number[] = [];
let sequence = 0;

type AccountOptions = {
  active?: boolean;
  mustChangePassword?: boolean;
  permissions?: PermissionOverrides;
  /** Sessão já vencida. */
  expired?: boolean;
};

/** Conta + sessão. O hash de senha é inválido de propósito: estas contas não fazem login por senha. */
export async function makeAccount(role: UserRole, options: AccountOptions = {}): Promise<TestAccount> {
  const tag = `${role}-${Date.now()}-${sequence++}`;
  const permissions = options.permissions ?? { grant: [], deny: [] };
  const [user] = await db
    .insert(users)
    .values({
      name: `[Teste] ${tag}`,
      email: `teste-acesso-${tag}@nos.test`,
      passwordHash: "x",
      role,
      active: options.active ?? true,
      mustChangePassword: options.mustChangePassword ?? false,
      permissions,
    })
    .returning();
  createdIds.push(user.id);
  const token = generateToken();
  const now = Date.now();
  await db.insert(sessions).values({ id: hashToken(token), userId: user.id, lastSeenAt: new Date(now), expiresAt: new Date(now + (options.expired ? -60_000 : 60 * 60_000)) });
  return { id: user.id, name: user.name, email: user.email, role: user.role, token, permissions };
}

/** Apaga as contas criadas por `makeAccount` (sessões, vínculos e membros vão junto, por cascata). */
export async function removeAccounts(): Promise<void> {
  if (createdIds.length) await db.delete(users).where(inArray(users.id, createdIds.splice(0)));
}

/** Executa um guarda e devolve o que aconteceu: o valor, `REDIRECT:<caminho>` ou `NOT_FOUND`. */
export async function outcome<T>(run: () => Promise<T>): Promise<T | string> {
  try {
    return await run();
  } catch (error) {
    const message = (error as Error)?.message ?? "";
    if (message.startsWith("REDIRECT:") || message === "NOT_FOUND") return message;
    throw error;
  }
}
