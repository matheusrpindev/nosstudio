import { z } from "zod";
import { CONTRACT_KINDS, CONTRACT_STATUSES } from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { f } from "@/server/action";

const MAX_BODY = 80_000;

/** Documento de contrato (formulário de criação e edição). */
export const contractSchema = z
  .object({
    title: f.text(160, "Informe o título do contrato."),
    kind: z.enum(CONTRACT_KINDS, { error: "Selecione o tipo." }),
    versionLabel: f.optionalText(40),
    clientId: f.optionalId(),
    projectId: f.optionalId(),
    proposalId: f.optionalId(),
    status: z.enum(CONTRACT_STATUSES, { error: "Selecione o status." }),
    signedAt: f.optionalDate(),
    validFrom: f.optionalDate(),
    validUntil: f.optionalDate(),
    fileMediaId: f.optionalId(),
    externalUrl: f.optionalText(500),
    body: f.optionalText(MAX_BODY),
    notes: f.optionalText(4000),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "socios" && data.clientId === null) {
      ctx.addIssue({ code: "custom", path: ["clientId"], message: "Selecione o cliente (só o acordo entre sócios dispensa)." });
    }
    if (data.validFrom && data.validUntil && data.validUntil < data.validFrom) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "O fim da vigência deve ser depois do início." });
    }
    if (data.externalUrl && !safeUrl(data.externalUrl)) {
      ctx.addIssue({ code: "custom", path: ["externalUrl"], message: "Informe um link válido (começando com https://)." });
    }
  })
  .transform((data) => ({ ...data, externalUrl: safeUrl(data.externalUrl) }));

/** Modelo de texto. */
export const templateSchema = z.object({
  title: f.text(160, "Informe o nome do modelo."),
  kind: z.enum(CONTRACT_KINDS, { error: "Selecione o tipo." }),
  versionLabel: f.optionalText(40),
  body: f.text(MAX_BODY, "Escreva o texto do modelo."),
});
