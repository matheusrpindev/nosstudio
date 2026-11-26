/**
 * Perfis, ambientes e permissões — camada PURA (sem banco, sem Next). Use em Server e Client Components.
 * O que depende de banco (membros de projeto, vínculo de cliente, convites) fica em `src/server/access`;
 * os guardas de página/ação (`requirePermission`, `requireEnvironment`…) ficam em `@/lib/auth`.
 * Documentação: docs/permissoes.md.
 */
export * from "./environments";
export * from "./matrix";
export * from "./landing";
