/** Contrato entre `flashToast()` (servidor) e o `<Toaster />` (cliente). */
export const FLASH_COOKIE = "nos_aviso";
export type FlashPayload = { m: string; t?: "sucesso" | "erro" | "info" };
