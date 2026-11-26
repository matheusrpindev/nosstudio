/**
 * Acesso por escopo (projeto, cliente), vínculos e convites — a parte de permissões que depende do banco.
 * Camada pura: `@/lib/permissions`. Guardas por perfil e módulo: `@/lib/auth`. Documentação: docs/permissoes.md.
 */
export * from "./scope";
export * from "./projects";
export * from "./guards";
export { canReadRestrictedMedia } from "./media";
