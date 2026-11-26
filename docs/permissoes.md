# Perfis, ambientes e permissões

Fundação pedida pelo briefing v2 (seções 01, 12, 17–19, 27, 28 e 32): quatro ambientes sobre a mesma base,
seis perfis (mais o acesso técnico), permissões por módulo e por projeto, tudo validado no servidor e com
isolamento testado. Este documento descreve **o que já está valendo**, **o que ficou pronto para as telas** e
**a tabela que falta aplicar nas páginas**.

## 1. Onde fica cada coisa

| Camada | Arquivo | O que tem |
| --- | --- | --- |
| Perfis e rótulos | `src/lib/domain.ts` | `USER_ROLES`, `USER_ROLE_LABELS`, `USER_ROLE_DESCRIPTIONS`, `TEAM_FUNCTIONS` |
| Ambientes | `src/lib/permissions/environments.ts` | quem entra em qual ambiente, o que já tem telas (`ENVIRONMENT_READY`, `RESTRICTED_PANEL_READY`) |
| Matriz | `src/lib/permissions/matrix.ts` | módulos, ações, **a matriz por perfil**, ajustes individuais, `can()` |
| Destino pós-login | `src/lib/permissions/landing.ts` | `landingFor()`, `panelAccess()` |
| Validação dos ajustes | `src/lib/permissions/schema.ts` | zod estrito (separado para o zod não ir ao cliente) |
| Guardas | `src/lib/auth/index.ts` | `requireUser`, `requireAdmin`, `requirePermission`, `requireEnvironment`, `authorizePermission`… |
| Escopo por projeto/cliente | `src/server/access/scope.ts` | `projectScope`, `clientScope`, `canAccessProject`, `canInProject`, `inScope` |
| O que o externo lê | `src/server/access/projects.ts` | visões por lista de campos permitidos (equipe e cliente) |
| Vínculos | `src/server/access/members.ts` | membros de projeto, usuários vinculados a cliente |
| Convites | `src/server/access/invites.ts`, `invite-actions.ts` | criar, revogar, aceitar |
| Arquivos privados | `src/server/access/media.ts` | quem abre cada arquivo de `/media` |

`src/lib/permissions` é **puro** (sem banco, sem Next): serve para esconder botões no cliente e para barrar no
servidor. Quem manda é sempre o servidor.

## 2. Perfis e ambientes

| Perfil | Ambientes | Observação |
| --- | --- | --- |
| `admin` Administrador(a) | Painel | acesso total |
| `socio` Sócio(a) | Painel | acesso total, incluindo o societário |
| `gestor` Gestor(a) de projetos | Painel (restrito) | operação, sem financeiro/configurações |
| `tecnico` Acesso técnico | Painel | suporte do desenvolvedor, como já era |
| `funcionario` Funcionário(a) | Área da Equipe **e** Painel (restrito) | começa pela Área da Equipe |
| `freelancer` Freelancer | Área da Equipe | só projetos em que foi escalado |
| `cliente` Cliente | Área do Cliente | só projetos dos clientes vinculados |

As duas contas atuais dos sócios são `admin` e nada muda para elas. `requireAdmin()` passou a aceitar `admin`
e `socio`.

### O que acontece hoje com quem não tem telas

`/equipe` e `/cliente` ainda não existem, e as páginas do painel ainda não checam permissão por módulo. Por
isso, **hoje só entram admin, sócio e técnico**. Para os demais (gestor, funcionário, freelancer, cliente, e um
técnico que tenha algum módulo negado):

- o **login** confere a senha e responde, na própria tela de login, _"Sua conta (…) está ativa, mas o acesso a
  (Área da Equipe / Área do Cliente / Painel Administrativo) ainda não foi liberado…"_ — **sem abrir sessão**
  (auditoria: `login_sem_ambiente`). Com a senha errada a resposta é a genérica de sempre;
- se, por qualquer caminho, existir uma sessão de um desses perfis, **todo guarda do painel a recusa** a cada
  requisição (redireciona para `/login?aviso=sem-acesso`; rotas de API respondem 401/403/404). Nunca cai no
  painel, nunca dá erro 500, nunca entra em laço de redirecionamento.

Foi a forma mais simples que não exige tela nova: a resposta clara mora na tela de login que já existe.

Chaves para abrir os ambientes (em `src/lib/permissions/environments.ts`):

| Chave | Hoje | Trocar para `true` quando… |
| --- | --- | --- |
| `ENVIRONMENT_READY.equipe` | `false` | `/equipe` existir (páginas com `requireTeamUser()` + escopo por projeto) |
| `ENVIRONMENT_READY.cliente` | `false` | `/cliente` existir (páginas com `requireClientUser()` + escopo por cliente) |
| `RESTRICTED_PANEL_READY` | `false` | a tabela da seção 7 estiver aplicada nas páginas do painel |

## 3. Guardas — quem passa em cada um

| Guarda | Passa | Uso |
| --- | --- | --- |
| `requireUser()` / `getCurrentUser()` | acesso **integral** ao painel: admin, sócio, técnico sem negações | páginas e rotas atuais, que não sabem a que módulo pertencem |
| `requireAdmin()` | admin, sócio | telas só de administrador |
| `requirePermission(mod, ação)` | conta do painel com a permissão no **módulo inteiro** | toda página e Server Action de um módulo |
| `requireProjectPermission(mod, ação, projectId)` (`@/server/access`) | idem, **ou** membro do projeto quando o alcance do perfil é "projetos" | registros ligados a um projeto (painel restrito do funcionário) |
| `requirePanelUser()` | qualquer perfil do painel | páginas comuns: Minha conta, Ajuda, casca do painel |
| `requireTeamUser()` / `requireClientUser()` / `requireEnvironment(env)` | perfis daquele ambiente | áreas futuras |
| `requireProjectAccess("equipe" \| "cliente", projectId, ação)` | membro do projeto / conta vinculada ao cliente do projeto; senão **404** | páginas de detalhe das áreas futuras |
| `requireSessionUser()` | qualquer conta com sessão | só o que é da própria conta (trocar senha, encerrar sessões) |
| `authorizePermission(mod, ação)` | como `requirePermission`, respondendo **JSON 401/403** | Route Handlers |
| `authorize(request, ação)` (`painel/api/media/guard.ts`) | `arquivos:<ação>` + mesma origem | API de upload |

Semântica: sem sessão → `/login`; troca de senha pendente → tela de troca; sem a permissão → início do painel
(como `requireAdmin` sempre fez) ou, para quem não tem acesso integral, `/login?aviso=sem-acesso`; quem é de
outro ambiente vai para o ambiente dele quando existir.

Por que `requireUser()` é mais estreito do que "qualquer conta do painel": a visão geral soma o financeiro, a
ficha do cliente mistura propostas, contratos e lançamentos, as listas não são filtradas por projeto. Deixar
gestor ou funcionário passar por `requireUser()` mostraria o que a matriz diz que eles não veem. Página não
migrada = fechada para perfis restritos (falha fechada).

## 4. Matriz padrão por perfil

Fonte: `MATRIX` em `src/lib/permissions/matrix.ts` (o teste `matrix.test.ts` repete a tabela inteira; mudar
uma célula sem atualizar o teste falha).

Ações: **V** ver · **E** criar/editar · **X** excluir · **B** baixar · **C** compartilhar. `(P)` = só nos
projetos em que a pessoa é membro. `—` = nada.

| Módulo | Admin / Sócio | Técnico | Gestor | Funcionário | Freelancer / Cliente |
| --- | --- | --- | --- | --- | --- |
| `leads` — Leads | tudo | tudo | tudo | — | — |
| `clientes` — Clientes | tudo | tudo | V E · B C | — | — |
| `propostas` — Propostas e orçamentos | tudo | tudo | tudo | — | — |
| `contratos` — Contratos | tudo | tudo | V E · B C | — | — |
| `projetos` — Projetos | tudo | tudo | V E · B C | V E · B · (P) | — |
| `tarefas` — Tarefas | tudo | tudo | tudo | V E · B · (P) | — |
| `agenda` — Agenda | tudo | tudo | tudo | V E · B · (P) | — |
| `conteudo` — Conteúdo (calendário editorial) | tudo | tudo | tudo | V E · B · (P) | — |
| `financeiro` — Financeiro | tudo | tudo | — | — | — |
| `societario` — Pró-labore, retiradas, distribuição | tudo | — | — | — | — |
| `marca` — Marca | tudo | tudo | tudo | V · · B · (P) | — |
| `arquivos` — Arquivos | tudo | tudo | tudo | V E · B · (P) | — |
| `equipe` — Equipe | tudo | tudo | V E · B C | — | — |
| `site` — Site | tudo | tudo | — | — | — |
| `relatorios` — Relatórios | tudo | tudo | — | — | — |
| `usuarios` — Usuários e permissões | tudo | — | — | — | — |
| `config` — Configurações | tudo | tudo | — | — | — |
| `auditoria` — Auditoria | tudo | — | — | — | — |
| `dados` — Exportação de dados | tudo | — | — | — | — |

Notas:

- **Técnico** = como era: usa o painel, não gerencia usuários, não exporta, não vê auditoria nem societário.
  Notificações continuam só de admin/sócio (`requireAdmin`).
- **Gestor** não exclui o que tem histórico (clientes, contratos, projetos, fichas da equipe). Propostas sim:
  o servidor só deixa excluir rascunhos e modelos. `site` e `relatorios` ficaram de fora por não estarem na
  lista de operação do briefing — dá para conceder individualmente.
- **Funcionário**: nunca o módulo inteiro. Não exclui, não compartilha com o cliente. `marca (P)` só passa a
  ter efeito quando a identidade visual for ligada a cliente/projeto (seção 14 do briefing).
- **Freelancer e cliente**: a matriz é do painel, e eles não entram nele. O que veem nas áreas deles vem do
  escopo (seção 6), não da matriz.

### Ajustes por usuário

Coluna JSON `users.permissions`: `{ "grant": ["financeiro:ver"], "deny": ["leads:excluir"] }`.

- **Negação vence concessão** e vence o padrão do perfil.
- Concessão vale no módulo inteiro e traz junto o "ver" do módulo. Negar o "ver" tira todas as ações do módulo.
- **Admin e sócio não recebem ajustes** (são ignorados na decisão e recusados ao gravar): ninguém é rebaixado
  por baixo do pano. Para restringir, muda-se o perfil.
- `usuarios` e `societario` são **reservados**: não podem ser concedidos por ajuste (senão um ajuste viraria
  escalada de privilégio).
- Freelancer e cliente não recebem concessões (não usam o painel).
- Mudar o perfil **zera os ajustes**, apaga os vínculos do perfil antigo e encerra as sessões.
- Vale na requisição seguinte: as permissões são lidas do banco junto com a sessão.
- Gravar: `setUserPermissions()` em `src/server/config/users.ts` (zod estrito) e a action
  `setUserPermissionsAction`. Ler: `parseOverrides()` (tolerante: JSON estranho vira "sem ajustes").

Por que coluna JSON e não tabela: o conjunto é pequeno e limitado (no máximo 95 chaves), é lido e gravado
sempre inteiro, e vem na mesma consulta da sessão — zero consultas a mais por requisição.

### Sempre existe quem administre

`updateUser` e `setUserActive` recusam rebaixar ou desativar a **última conta ativa de admin ou sócio**
(`last_admin`). Trocar entre admin e sócio é livre. As actions também impedem mudar o próprio perfil, as
próprias permissões e desativar a própria conta.

## 5. Convites

Tabela `user_invites`. Não existe cadastro público: **sem convite válido não nasce conta** (fora de
Configurações › Usuários e da linha de comando).

- Só quem tem `usuarios:editar` (admin, sócio) cria e revoga. Conferido na action e de novo na função.
- O banco guarda só o **SHA-256 do token**; o token aparece uma vez, no link do e-mail. Validade: 7 dias.
- Convite de `cliente` exige a ficha do cliente; projeto só em convites de funcionário/freelancer.
- Um convite pendente por e-mail (criar outro revoga o anterior). E-mail que já tem conta não é convidado.
- Aceitar: nome + senha (mesma política de senha), **e-mail igual ao convidado**. Expirado, revogado, já
  usado, token desconhecido e e-mail divergente dão a mesma mensagem. O convite é gasto dentro da transação.
- A conta nasce com o perfil **do convite**, sem troca de senha obrigatória, e com os vínculos (ficha de
  cliente; membro do projeto só com "ver"). **Não abre sessão**: a pessoa entra pelo login.
- Limites: 30 convites/hora por quem convida; 10 tentativas de aceite a cada 15 min por IP.
- Auditoria: `convite_criado`, `convite_revogado`, `convite_aceito` (sem e-mail nem nome do convidado).
- A exportação de dados não inclui `user_invites`.

Falta: a tela de aceite (`/convite?token=…`, usando `getPendingInvite` + `acceptInviteAction`) e a lista de
convites em Usuários (`listInvites`, `createInviteAction`, `revokeInviteAction`).

## 6. Escopo por projeto e por cliente

Tabelas: `project_members` (projeto, usuário, papel em texto livre, `can_view` / `can_edit` / `can_download` /
`can_upload`) e `client_users` (conta de perfil `cliente` ↔ ficha de cliente, N:N).

| Quem | `projectScope(user)` | `clientScope(user)` |
| --- | --- | --- |
| admin, sócio, gestor, técnico | `"todos"` | `"todos"` |
| funcionário, freelancer | projetos em que é membro com "ver" | `[]` |
| cliente | projetos dos clientes vinculados | fichas vinculadas |

- `canAccessProject(user, projectId, "ver" | "editar" | "baixar" | "enviar")`: vale nos três ambientes.
  Projeto alheio, inexistente e id inválido respondem igual (`false` → 404 nos guardas).
- `canInProject(user, mod, ação, projectId)`: matriz + participação (painel).
- `inScope(coluna, escopo)`: condição Drizzle para listas. Escopo vazio = nenhuma linha (nunca "todas").
- O cliente só **vê**. Baixar depende da liberação explícita de arquivos (galerias), que ainda não existe.
- Vínculo do perfil errado não vale: conta de cliente nunca é "membro"; só conta de cliente é vinculada a
  ficha. Revogar (tirar do projeto, desvincular, desativar a conta) vale na requisição seguinte.
- Estas funções devolvem ids e sim/não. Para o que um externo pode **ler**, use `getTeamProjectView` /
  `getClientProjectView`: listas de campos permitidos — sem notas internas, backup, links de trabalho,
  proposta de origem, financeiro, nem dados de outros membros ou de outros clientes.

Regra para as telas novas: **toda lista passa por `inScope`, todo detalhe por `requireProjectAccess` /
`requireProjectPermission` com o id lido do banco.** Conferir só o id da URL não basta.

## 7. Tabela rota → permissão

### 7.1 Já aplicado

**Server Actions do painel** (`src/app/painel/**/actions.ts`) — regra: `requirePermission("<módulo>", "editar")`;
funções `delete…` usam `"excluir"`. O teste `actions-access.db.test.ts` varre os arquivos e falha se uma
action exportada não começar por um guarda, ou usar `requireUser()` genérico.

| Arquivo | Módulo | Exceções à regra |
| --- | --- | --- |
| `leads/actions.ts` | `leads` | `markLeadReadAction` → `leads:ver`; `convertLeadAction` → `leads:editar` + `clientes:editar` |
| `clientes/actions.ts` | `clientes` | — |
| `orcamentos/actions.ts` | `propostas` | `convertToProjectAction` → + `projetos:editar`; `linkContractAction` → + `contratos:editar` |
| `contratos/actions.ts` | `contratos` | — |
| `projetos/actions.ts` | `projetos` | `addProjectTaskAction` → `projetos:ver` + `tarefas:editar`; itens de checklist → `projetos:editar` |
| `tarefas/actions.ts` | `tarefas` | — |
| `agenda/actions.ts` | `agenda` | — |
| `conteudo/actions.ts` | `conteudo` | — |
| `financeiro/actions.ts` | `financeiro` | — |
| `marca/actions.ts` | `marca` | — |
| `site/**/actions.ts` | `site` | — |
| `config/propostas/actions.ts` | `config` | — |
| `config/notificacoes/actions.ts` | — | `requireAdmin()` (admin, sócio) |
| `config/usuarios/actions.ts` | `usuarios` | tudo `usuarios:editar` |
| `conta/actions.ts` | — | `requireSessionUser()` (própria conta) |
| `kit/**/actions.ts` | — | `requireUser()` (demonstração do kit) |
| `src/lib/auth/actions.ts` | — | troca de senha: `requireSessionUser({ allowPasswordChange })` |
| `src/server/access/invite-actions.ts` | `usuarios` | aceite é público (convite válido) |

**Route Handlers**

| Rota | Exige |
| --- | --- |
| `GET /media/[...key]` (arquivo privado ou imagem fora do ar) | sessão do painel + módulo dono do arquivo: comprovante → `financeiro:baixar`; contrato → `contratos:baixar`; marca → `marca:baixar`; sem dono → quem enviou ou `arquivos:ver`; imagem pública não publicada → `site:ver`. Senão **404** |
| `POST /painel/api/media`, `PATCH /painel/api/media/[id]` | `arquivos:editar` + mesma origem |
| `DELETE /painel/api/media/[id]` | `arquivos:excluir` + mesma origem |
| `GET /painel/orcamentos/[id]/pdf` | `propostas:ver`; com `?baixar=1`, `propostas:baixar` |
| `GET /painel/config/dados/exportar` | `dados:baixar` |
| `GET /painel/clientes/exportar`, `GET /painel/clientes/[id]/dados` | `dados:baixar` + `clientes:ver` |
| `GET /painel/financeiro/exportar` | `dados:baixar` + `financeiro:ver` |

### 7.2 A aplicar nas páginas (arquivos `.tsx`, intocados nesta etapa)

Trocar o `await requireUser()` do topo de cada página pelo guarda abaixo. Depois de **todas** trocadas,
`RESTRICTED_PANEL_READY = true`.

| Página | Guarda |
| --- | --- |
| `_shell/shell.tsx` (casca) | `requirePanelUser({ allowPasswordChange: true })`; menu filtrado por `can(user, módulo, "ver")` |
| `/painel` (visão geral) | `requirePanelUser()`; cada bloco condicionado a `can(…, "ver")` do seu módulo (financeiro, leads, propostas, tarefas, agenda); consultas de `dashboard/queries.ts` precisam de escopo |
| `/painel/[...resto]`, `/painel/ajuda`, `/painel/conta` | `requirePanelUser()` |
| `/painel/conta/senha` | `requirePanelUser({ allowPasswordChange: true })` |
| `/painel/leads`, `/leads/[id]` · `/leads/novo` | `leads:ver` · `leads:editar` |
| `/painel/clientes`, `/clientes/[id]` · `/clientes/novo`, `/[id]/editar` | `clientes:ver` · `clientes:editar` (na ficha, blocos de propostas/projetos/contratos/financeiro por `can`) |
| `/painel/orcamentos`, `/[id]`, `/modelos` · `/novo` | `propostas:ver` · `propostas:editar` |
| `/painel/contratos`, `/[id]`, `/modelos`, `/modelos/[id]` · `/novo`, `/[id]/editar`, `/modelos/novo` | `contratos:ver` · `contratos:editar` |
| `/painel/projetos` · `/projetos/[id]` · `/novo`, `/[id]/editar` | `projetos:ver` (lista com `inScope`) · `requireProjectPermission("projetos", "ver", id)` · `projetos:editar` |
| `/painel/tarefas` | `tarefas:ver` (lista com `inScope` para o funcionário) |
| `/painel/agenda`, `/agenda/[id]` · `/agenda/novo` | `agenda:ver` · `agenda:editar` |
| `/painel/conteudo`, `/conteudo/[id]` · `/conteudo/novo` | `conteudo:ver` · `conteudo:editar` |
| `/painel/financeiro`, `/financeiro/[id]` · `/novo`, `/novo/parcelas` | `financeiro:ver` · `financeiro:editar` |
| `/painel/marca`, `/marca/[id]` · `/marca/novo` | `marca:ver` · `marca:editar` |
| `/painel/site/**` (listas) · `/novo`, `/[id]`, `/textos/[secao]` | `site:ver` · `site:editar` |
| `/painel/config`, `/config/propostas` | `config:ver` |
| `/painel/config/notificacoes` | `requireAdmin()` (já é) |
| `/painel/config/usuarios` | `usuarios:ver` (hoje `requireAdmin()`, equivalente) |
| `/painel/config/auditoria` | `auditoria:ver` (hoje `requireAdmin()`) |
| `/painel/config/dados` | `dados:baixar` (hoje `requireAdmin()`) |
| `/painel/kit/**` | `requireUser()` (fica como está) |
| `(auth)/login/page.tsx` | trocar `getCurrentUser()` + `redirect(next)` por `getSessionUser()` + `landingFor(user)`; mostrar os avisos `?aviso=sem-acesso` e `?aviso=conta-criada` |

Ajustes de interface que acompanham (não são barreira de segurança — o servidor já barra):

- `user.role === "admin"` em `config/page.tsx`, `config/layout.tsx`, `conta/page.tsx`, `clientes/page.tsx`,
  `clientes/[id]/page.tsx`, `financeiro/page.tsx` e `painel/page.tsx` → `isAdminRole(user.role)` ou
  `can(user, "dados", "baixar")`. Enquanto não trocar, **uma conta `socio` não vê os botões de exportar nem as
  abas de administrador** (as rotas funcionam para ela).
- Botões de excluir/editar: esconder com `can(user, módulo, ação)`.
- `painel/nav.ts`: acrescentar o módulo de cada item para o menu filtrar sozinho.

### 7.3 Áreas futuras

- `/equipe/**`: `requireTeamUser()`; detalhe de projeto com `requireProjectAccess("equipe", id, ação)`; leitura
  por `getTeamProjectView` / `listTeamProjectViews`.
- `/cliente/**`: `requireClientUser()`; `requireProjectAccess("cliente", id)`; leitura por
  `getClientProjectView` / `listClientProjectViews`.
- O `proxy.ts` já cobre `/equipe/:path*` e `/cliente/:path*` (sem cookie → login; API → 401 JSON).

## 8. Testes de isolamento

| Arquivo | Cobre |
| --- | --- |
| `src/lib/permissions/matrix.test.ts` | matriz inteira perfil × módulo × ação; ajustes (concessão, negação, negação vence, reservados, admin/sócio); validação |
| `src/lib/permissions/landing.test.ts` | ambientes por perfil; integral × restrito; destino hoje e com tudo pronto |
| `src/lib/auth/guards.db.test.ts` | cada `require*` para cada perfil; sem sessão; sessão vencida; conta desativada; troca de senha obrigatória; ajustes valendo na requisição seguinte |
| `src/lib/auth/login-landing.db.test.ts` | login por perfil: destino, resposta clara sem sessão, `next` |
| `src/server/access/scope.db.test.ts` | A não vê projeto de B trocando o id; cliente A × cliente B; filtros de lista; nada interno nas visões; revogação |
| `src/server/access/invites.db.test.ts` | expirado, revogado, reutilizado (inclusive simultâneo), e-mail divergente, senha, limites, vínculos |
| `src/server/access/routes.db.test.ts` | `/media`, PDF, exportações e API de upload com cada perfil |
| `src/app/painel/actions-access.db.test.ts` | todas as Server Actions do painel × perfis |
| `src/server/config/permissions.db.test.ts` | último admin/sócio; `setUserPermissions` |
| `src/proxy.test.ts` | matcher dos três ambientes |

Apoio: `src/test/accounts.ts` (`makeAccount(perfil)` cria conta + sessão no banco de teste).

## 9. Banco

Migration `drizzle/0001_perfis_e_permissoes.sql` (só acrescenta): tabelas `project_members`, `client_users`,
`user_invites` e a coluna `users.permissions`. `users.role` é texto sem `CHECK`: os perfis novos não exigem
migration. `npm run db:seed -- --dev --demo` cria uma conta de exemplo por perfil novo
(`gestor@`, `funcionario@`, `freelancer@`, `cliente@nos.local`) e as liga ao projeto e ao cliente de exemplo.

## 10. Pendências conhecidas

- **Troca de senha obrigatória fora do painel**: a tela vive em `/painel/conta/senha`. Conta de equipe/cliente
  com senha temporária (criada em Usuários, não por convite) não tem onde trocar; o caminho hoje é "Esqueci
  minha senha". Resolver ao abrir as áreas (tela de conta neutra ou por ambiente).
- **Painel restrito do funcionário**: as actions atuais exigem a permissão no módulo inteiro, então o
  funcionário não executa nenhuma. Para ele, cada action de tarefa/agenda/conteúdo/projeto precisa ler o
  `projectId` do registro e usar `requireProjectPermission`.
- **Autenticação em dois fatores**: fora desta etapa.
- **Sem indexação** de `/equipe` e `/cliente` (`X-Robots-Tag` em `next.config.ts`) ao criar as rotas.
- `CLAUDE.md` (seção Segurança) e `docs/manual-do-painel.md` ainda descrevem só `requireUser`/`requireAdmin` e
  os dois perfis antigos.
