/**
 * O que cada conta consegue ABRIR nas telas do painel — a mesma regra para o menu, os atalhos, os cartões da
 * visão geral e os guardas de página. Arquivo puro.
 *
 * A matriz (./matrix.ts) diz o ALCANCE de cada permissão: o módulo inteiro ("todos") ou só os projetos em que a
 * pessoa é membro ("projetos" — o funcionário). Uma tela só pode ser aberta por quem tem alcance "projetos"
 * quando as consultas e as ações dela filtram por projeto. Os módulos abaixo já fazem isso; os demais continuam
 * exigindo o módulo inteiro (falha fechada): uma tela que não sabe filtrar não abre para quem só vê os próprios
 * projetos.
 */
import { panelAccess } from "./landing";
import type { Action, Module, PermissionSubject } from "./matrix";
import { permissionScope } from "./matrix";

/**
 * Módulos cujas TELAS do painel respeitam o alcance "projetos" (listas com `inScope`, detalhes e ações com
 * `requireProjectPermission`).
 *
 * Ficaram de fora, de propósito:
 * - `agenda`: as telas ainda exigem o módulo inteiro;
 * - `conteudo` e `marca`: os registros não têm vínculo com projeto no banco — não há como filtrar;
 * - `arquivos`: a API de envio (`/painel/api/media`) exige o módulo inteiro.
 * Para incluir um módulo aqui, antes faça TODAS as consultas e ações dele filtrarem por projeto e estenda os
 * testes de isolamento (`src/app/painel/pages-access.db.test.ts`).
 */
export const PROJECT_SCOPED_PANEL_MODULES: readonly Module[] = ["projetos", "tarefas"];

/**
 * A pessoa consegue usar as telas de `mod` no painel para `action`? Sim se tem a permissão no módulo inteiro,
 * ou se tem "nos projetos em que está" e o módulo já filtra por projeto. É a regra do menu e dos botões; a
 * barreira de verdade são os guardas do servidor (`requirePermission`, `requireScopedPermission`).
 */
export function canUsePanelModule(subject: PermissionSubject, mod: Module, action: Action = "ver"): boolean {
  const scope = permissionScope(subject, mod, action);
  return scope === "todos" || (scope === "projetos" && PROJECT_SCOPED_PANEL_MODULES.includes(mod));
}

/**
 * "Observações internas" da ficha do cliente — a tela promete "só os sócios veem". Continuam visíveis para quem
 * já as via (acesso integral: admin, sócio, técnico) e ficam FORA do alcance dos perfis restritos (gestor):
 * não aparecem na ficha nem no formulário, e salvar o cadastro não as altera.
 */
export function seesInternalNotes(subject: PermissionSubject): boolean {
  return panelAccess(subject) === "integral";
}
