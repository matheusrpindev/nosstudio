"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { actionOk, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { f, parseForm } from "@/server/action";
import { saveSetting } from "@/server/settings";

const percent = (label: string) => f.number(`Informe ${label} (ex.: 30 ou 12,5).`).pipe(z.number().min(0, `${label} não pode ser negativa.`).max(100, `${label} não pode passar de 100%.`));

const schema = z.object({
  validityDays: f.number("Informe a validade em dias.").pipe(z.number().int("Use um número inteiro de dias.").min(1, "A validade mínima é 1 dia.").max(365, "A validade máxima é 365 dias.")),
  entryPercent: percent("a entrada"),
  aboutText: f.optionalText(3000),
  paymentNotes: f.optionalText(3000),
  conditions: f.optionalText(6000),
  taxPercent: percent("a taxa de tributos"),
  targetMarginPercent: percent("a margem-alvo"),
});

export async function saveProposalDefaultsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("config", "editar");
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;

  await saveSetting("proposal", parsed.data, user.id);
  await logAudit({ user, action: "update", entity: "settings", entityId: "proposal", summary: "Atualizou os padrões de proposta" });
  refresh();
  return actionOk("Padrões salvos. Valem para os próximos orçamentos.");
}
