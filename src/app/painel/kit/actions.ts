"use server";

import { z } from "zod";
import { actionError, actionOk, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth";
import { f, parseForm } from "@/server/action";

const demoSchema = z.object({
  nome: f.text(80, "Informe um nome."),
  email: f.optionalEmail(),
  tipo: z.enum(["foto", "video", "ambos"], { error: "Escolha uma opção." }),
  data: f.optionalDate(),
  horario: f.optionalTime(),
  observacoes: f.optionalText(500),
  aceite: f.checkbox().refine((value) => value, "Marque para continuar."),
  publicado: f.checkbox(),
});

/** Action de demonstração da vitrine: valida e devolve o estado, sem gravar nada. */
export async function kitDemoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = parseForm(demoSchema, formData);
  if (!parsed.ok) return parsed.state;
  if (parsed.data.nome.toLowerCase() === "erro") return actionError("Exemplo de erro geral devolvido pela action.", { values: { nome: parsed.data.nome } });
  return actionOk(`Formulário válido — olá, ${parsed.data.nome}!`);
}

/** Demonstração do ConfirmDialog: só responde ok. */
export async function kitConfirmAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireUser();
  return actionOk("Ação confirmada (nada foi apagado).");
}
