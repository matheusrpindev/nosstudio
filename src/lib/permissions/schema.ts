/**
 * Validação ESTRITA (zod) dos ajustes individuais de permissão, usada ao GRAVAR (`setUserPermissions`):
 * qualquer chave desconhecida, campo a mais ou formato errado é erro. Repetidas são removidas.
 * Importe daqui (não do índice de `@/lib/permissions`): assim o zod não entra nos Client Components.
 */
import "@/lib/zod-setup";
import { z } from "zod";
import { ACTIONS, isPermissionKey, MODULES, type PermissionKey } from "./matrix";

const keyList = z
  .array(z.string().refine(isPermissionKey, "Permissão desconhecida."))
  .max(MODULES.length * ACTIONS.length)
  .transform((keys) => [...new Set(keys)].sort() as PermissionKey[]);

export const permissionOverridesSchema = z.strictObject({ grant: keyList, deny: keyList });
