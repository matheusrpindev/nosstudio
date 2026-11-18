"use server";

/**
 * Actions de demonstração da vitrine /painel/kit/widgets. Não gravam nada.
 */
import { requireUser } from "@/lib/auth";
import { actionOk, type ActionState } from "@/lib/action-state";
import { parseBRL } from "@/lib/format";
import { jsonField } from "@/server/action";

/** Coluna que sempre recusa o movimento — serve para ver o "desfazer" do <Board>. */
const BLOCKED_COLUMN = "bloqueada";

export async function demoMoveAction(cardId: number, toColumnId: string): Promise<ActionState> {
  await requireUser();
  if (!Number.isInteger(cardId) || typeof toColumnId !== "string") return { ok: false, message: "Movimento inválido." };
  if (toColumnId === BLOCKED_COLUMN) {
    return { ok: false, message: "Demonstração de erro: esta coluna recusa cartões, então o cartão voltou para onde estava." };
  }
  return { ok: true };
}

export type DemoEcho = Record<string, unknown>;

/** Devolve o que o servidor leu do formulário — mostra o formato de cada widget do lado do servidor. */
export async function demoEchoAction(_prev: ActionState<DemoEcho>, formData: FormData): Promise<ActionState<DemoEcho>> {
  await requireUser();
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : null;
  };
  return actionOk("Recebido pelo servidor (nada foi gravado).", {
    "jsonField(formData, 'itens')": jsonField(formData, "itens"),
    "jsonField(formData, 'entregaveis')": jsonField(formData, "entregaveis"),
    "jsonField(formData, 'checklist')": jsonField(formData, "checklist"),
    "formData.get('descricao')": text("descricao"),
    "formData.get('valor')": text("valor"),
    "parseBRL(valor) → centavos": parseBRL(text("valor")),
    "formData.get('telefone')": text("telefone"),
    "formData.get('capa') → id": text("capa"),
    "jsonField(formData, 'galeria') → ids": jsonField(formData, "galeria"),
    "formData.get('contrato') → id": text("contrato"),
  });
}
