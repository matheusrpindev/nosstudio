/**
 * Formato padrão de retorno das Server Actions usadas com `useActionState`.
 * - `ok: true` + `message` → sucesso (mostrar aviso).
 * - `ok: false` + `message` e/ou `fieldErrors` → erro (mostrar no formulário).
 * - `values` devolve o que o usuário digitou para repopular o formulário após um erro.
 */
export type ActionState<TData = undefined> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  data?: TData;
  /** Muda a cada resposta — útil como `key` para resetar formulários ou disparar toasts. */
  nonce?: number;
};

export const initialActionState: ActionState<never> = { ok: false };

export function actionError<TData = undefined>(
  message: string,
  extra: Pick<ActionState<TData>, "fieldErrors" | "values"> = {},
): ActionState<TData> {
  return { ok: false, message, nonce: Date.now(), ...extra };
}

export function actionOk<TData = undefined>(message?: string, data?: TData): ActionState<TData> {
  return { ok: true, message, data, nonce: Date.now() };
}
