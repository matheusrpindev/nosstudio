import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { passwordResetTokens } from "@/db/schema";

/**
 * Invalida todos os links de redefinição de senha pendentes de uma conta. Chame sempre que a senha mudar por
 * outro caminho (Minha conta, senha gerada por administrador, linha de comando), o e-mail da conta mudar ou o
 * acesso for revogado: um link pedido antes não pode sobreviver à troca.
 */
export async function revokeResetTokens(userId: number, executor: DbOrTx = db): Promise<void> {
  await executor.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
}
