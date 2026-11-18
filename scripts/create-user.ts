/**
 * Cria (ou redefine) uma conta do painel pela linha de comando.
 *
 *   npm run user:create -- --name "Pedro Henrique" --email pedro@dominio.com.br
 *   npm run user:create -- --name "Dev" --email dev@dominio.com.br --role tecnico
 *   npm run user:create -- --email pedro@dominio.com.br --reset        (gera nova senha temporária)
 *   npm run user:create -- --email dev@dominio.com.br --deactivate     (revoga o acesso)
 *   npm run user:create -- --email pedro@dominio.com.br --unlock       (destrava o login após "Muitas tentativas")
 *
 * A senha temporária é mostrada UMA vez aqui no terminal; no primeiro login o sistema exige a troca.
 */
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { unlockLogin } from "@/lib/auth/rate-limit";
import { revokeResetTokens } from "@/lib/auth/reset-tokens";
import { USER_ROLES, type UserRole } from "@/lib/domain";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function temporaryPassword(): string {
  // 4 blocos fáceis de digitar: letras e números, sem caracteres ambíguos.
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error('Informe um e-mail válido: --email "pessoa@dominio.com.br"');
  }
  const [existing] = await db.select().from(users).where(eq(users.email, email));

  if (flag("deactivate")) {
    if (!existing) throw new Error("Conta não encontrada.");
    await db.update(users).set({ active: false }).where(eq(users.id, existing.id));
    await db.delete(sessions).where(eq(sessions.userId, existing.id));
    await revokeResetTokens(existing.id);
    console.log(`✔ Acesso de ${email} revogado (conta desativada e sessões encerradas).`);
    return;
  }

  if (flag("unlock")) {
    if (!existing) throw new Error("Conta não encontrada.");
    // Zera o limite de tentativas por e-mail (alguém pode tê-lo estourado de propósito). A senha não muda.
    await unlockLogin(email);
    console.log(`✔ Login de ${email} destravado. A senha continua a mesma.`);
    return;
  }

  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);

  if (existing) {
    if (!flag("reset")) throw new Error("Já existe uma conta com este e-mail. Use --reset para gerar uma nova senha.");
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: true, active: true })
      .where(eq(users.id, existing.id));
    await db.delete(sessions).where(eq(sessions.userId, existing.id));
    await revokeResetTokens(existing.id);
    await unlockLogin(email);
    console.log(`✔ Senha de ${email} redefinida.`);
  } else {
    const name = arg("name")?.trim();
    if (!name) throw new Error('Informe o nome: --name "Nome da pessoa"');
    const role = (arg("role") ?? "admin") as UserRole;
    if (!USER_ROLES.includes(role)) throw new Error(`Perfil inválido. Use: ${USER_ROLES.join(", ")}`);
    await db.insert(users).values({ name, email, passwordHash, role, mustChangePassword: true });
    console.log(`✔ Conta criada: ${name} <${email}> (${role}).`);
  }
  console.log(`\n  Senha temporária: ${password}\n\n  Ela aparece só agora. No primeiro acesso em /login o sistema pede uma senha nova.`);
}

main().catch((error) => {
  console.error(`✖ ${(error as Error).message}`);
  process.exit(1);
});
