import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type AuditInput = {
  user?: { id: number; name: string } | null;
  /** Verbo curto: "login", "logout", "create", "update", "delete", "status", "export", "pdf"… */
  action: string;
  /** Entidade afetada: "client", "proposal", "site_content"… */
  entity?: string;
  entityId?: string | number;
  /** Frase curta em pt-BR. Nunca inclua senhas, tokens ou dados sensíveis. */
  summary?: string;
};

/** Registra uma linha na trilha de auditoria. Nunca derruba a operação principal se falhar. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: input.user?.id ?? null,
      userName: input.user?.name ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId != null ? String(input.entityId) : null,
      summary: input.summary?.slice(0, 500) ?? null,
    });
  } catch (error) {
    console.error("[audit] falha ao registrar", error);
  }
}
