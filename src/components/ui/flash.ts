import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE, type FlashPayload } from "./flash-shared";

/**
 * Deixa um aviso para aparecer como toast DEPOIS de um `redirect()` numa Server Action:
 *
 *   await flashToast("Lead excluído.");
 *   redirect("/painel/leads");
 *
 * (Sem redirect, devolva `actionOk("…")` — o `<ActionForm>` já mostra o toast.)
 * O aviso viaja num cookie de vida curta, lido e apagado pelo `<Toaster />`. Não coloque dados pessoais na mensagem.
 */
export async function flashToast(message: string, tone: FlashPayload["t"] = "sucesso"): Promise<void> {
  const payload: FlashPayload = { m: message.slice(0, 300), t: tone };
  (await cookies()).set(FLASH_COOKIE, JSON.stringify(payload), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
    httpOnly: false, // o Toaster lê no navegador
  });
}
