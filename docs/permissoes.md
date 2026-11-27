# Perfis, ambientes e permissões

Fundação pedida pelo briefing v2 (seções 01, 12, 17–19, 27, 28 e 32): quatro ambientes sobre a mesma base,
seis perfis (mais o acesso técnico), permissões por módulo e por projeto, tudo validado no servidor e com
isolamento testado. Este documento descreve **o que está valendo**: a camada de dados e lógica (fundação) e a
camada de telas do painel (aplicada — seção 7.2). Ficam para as próximas etapas a Área da Equipe e a Área do
Cliente (seção 7.3) e as pendências da seção 10.

## 1. Onde fica cada coisa

| Camada | Arquivo | O que tem |
| --- | --- | --- |
| Perfis e rótulos | `src/lib/domain.ts` | `USER_ROLES`, `USER_ROLE_LABELS`, `USER_ROLE_DESCRIPTIONS`, `TEAM_FUNCTIONS` |
| Ambientes | `src/lib/permissions/environments.ts` | quem entra em qual ambiente, o que já tem telas (`ENVIRONMENT_READY`, `RESTRICTED_PANEL_READY`) |
| Telas do painel | `src/lib/permissions/panel.ts` | `canUsePanelModule()` (menu, botões, guardas), módulos que filtram por projeto (`PROJECT_SCOPED_PANEL_MODULES`), `seesInternalNotes()` |
| Matriz | `src/lib/permissions/matrix.ts` | módulos, ações, **a matriz por perfil**, ajustes individuais, `can()` |
| Destino pós-login | `src/lib/permissions/landing.ts` | `landingFor()`, `panelAccess()` |
| Validação dos ajustes | `src/lib/permissions/schema.ts` | zod estrito (separado para o zod não ir ao cliente) |
| Guardas | `src/lib/auth/index.ts`, `src/server/access/guards.ts` | `requirePermission`, `requirePanelUser`, `requireAdmin`, `requireUser`, `requireEnvironment`, `authorizePermission`; `requireScopedPermission`, `requireProjectPermission`, `requireProjectAccess` |
| Escopo por projeto/cliente | `src/server/access/scope.ts` | `projectScope`, `clientScope`, `moduleScope`, `scopeAllows`, `canAccessProject`, `canInProject`, `inScope` |
| O que o externo lê | `src/server/access/projects.ts` | visões por lista de campos permitidos (equipe e cliente) |
| Vínculos | `src/server/access/members.ts` | membros de projeto, usuários vinculados a cliente |
| Convites | `src/server/access/invites.ts`, `invite-actions.ts` | criar, convidar de novo, revogar, aceitar |
| Telas | `painel/config/usuarios/**`, `(auth)/convite`, `(auth)/conta/senha`, `painel/projetos/_components/project-team*`, `painel/clientes/client-access*` | usuários, convites, permissões por conta, aceite, troca de senha fora do painel, equipe do projeto, acessos do cliente |
| Arquivos privados | `src/server/access/media.ts` | quem abre cada arquivo de `/media` |
| Privacidade da agenda | `src/server/agenda/privacy.ts`, `src/server/agenda/queries.ts` | `toVisibleEvent`: compromisso particular só sai inteiro para quem participa (seção 6.1) |
| A agenda vista de fora | `src/server/agenda-related.ts` | o que a visão geral, a ficha do cliente, o projeto, as exportações e `/media` leem da agenda — sempre pelas consultas da agenda |

`src/lib/permissions` é **puro** (sem banco, sem Next): serve para esconder botões no cliente e para barrar no
servidor. Quem manda é sempre o servidor.

## 2. Perfis e ambientes

| Perfil | Ambientes | Observação |
| --- | --- | --- |
| `admin` Administrador(a) | Painel | acesso total |
| `socio` Sócio(a) | Painel | acesso total, incluindo o societário |
| `gestor` Gestor(a) de projetos | Painel (restrito) | operação, sem financeiro/site/configurações |
| `tecnico` Acesso técnico | Painel | suporte do desenvolvedor, como já era |
| `funcionario` Funcionário(a) | Área da Equipe **e** Painel (restrito) | hoje entra no painel e vê só os projetos em que é membro (e as tarefas deles); quando a Área da Equipe abrir, começa por ela |
| `freelancer` Freelancer | Área da Equipe | só projetos em que foi escalado |
| `cliente` Cliente | Área do Cliente | só projetos dos clientes vinculados |

As duas contas atuais dos sócios são `admin` e nada muda para elas. `requireAdmin()` passou a aceitar `admin`
e `socio`.

### Quem entra hoje

- **Admin, sócio e técnico**: painel inteiro (o técnico, sem usuários, auditoria, exportação e societário).
- **Gestor e funcionário** (e um técnico com algum módulo negado): **painel restrito** — aberto nesta etapa
  (`RESTRICTED_PANEL_READY = true`). O menu, a visão geral e cada página mostram só o que a matriz permite; uma
  URL de módulo negado leva a `/login?aviso=sem-acesso`, que mostra "Sua conta não tem acesso a essa página" com o
  botão de volta ao início do painel (a sessão continua).
- **Freelancer e cliente**: `/equipe` e `/cliente` ainda não existem. O **login** confere a senha e responde, na
  própria tela, _"Sua conta (…) está ativa, mas o acesso a (Área da Equipe / Área do Cliente) ainda não foi
  liberado…"_ — **sem abrir sessão** (auditoria: `login_sem_ambiente`). Com a senha errada a resposta é a genérica
  de sempre. Se, por qualquer caminho, existir uma sessão de um desses perfis, **todo guarda do painel a recusa**
  a cada requisição (páginas e actions: `/login?aviso=sem-acesso`; rotas de API: 401/403/404).
- **Única exceção de sessão sem ambiente**: conta de freelancer/cliente ainda com a **senha provisória**. O login
  abre a sessão só para a troca na tela neutra `/conta/senha`; trocada a senha, a sessão é encerrada e a pessoa
  volta ao login com o aviso `senha-criada`. Durante esse intervalo nenhum guarda de ambiente a deixa passar
  (`login-landing.db.test.ts`).

Chaves para abrir os ambientes (em `src/lib/permissions/environments.ts`):

| Chave | Hoje | Trocar para `true` quando… |
| --- | --- | --- |
| `ENVIRONMENT_READY.equipe` | `false` | `/equipe` existir (páginas com `requireTeamUser()` + escopo por projeto) |
| `ENVIRONMENT_READY.cliente` | `false` | `/cliente` existir (páginas com `requireClientUser()` + escopo por cliente) |
| `RESTRICTED_PANEL_READY` | **`true`** | (aplicado) — voltar para `false` é o freio de emergência: fecha o LOGIN de gestor, funcionário e técnico com negações. Sessões já abertas continuam valendo até expirar ou a conta ser desativada |

## 3. Guardas — quem passa em cada um

| Guarda | Passa | Uso |
| --- | --- | --- |
| `requireUser()` / `getCurrentUser()` | acesso **integral** ao painel: admin, sócio, técnico sem negações | só a demonstração do kit (`/painel/kit`) e a base de `requireAdmin` |
| `requireAdmin()` | admin, sócio | telas só de administrador |
| `requirePermission(mod, ação)` | conta do painel com a permissão no **módulo inteiro** | toda página e Server Action de um módulo |
| `requireScopedPermission(mod, ação)` (`@/server/access`) | idem, **ou** quem tem a permissão "nos projetos em que está" — só nos módulos de `PROJECT_SCOPED_PANEL_MODULES`. Devolve `{ user, scope }` | listas e actions de projetos e tarefas: a lista usa `inScope(coluna, scope)`; a action confere `scopeAllows(scope, projectId do banco)` |
| `requireProjectPermission(mod, ação, projectId)` (`@/server/access`) | idem, **ou** membro do projeto quando o alcance do perfil é "projetos" | página de detalhe de um registro de projeto (`/painel/projetos/[id]`) |
| `requirePanelUser()` | qualquer perfil do painel | páginas comuns: Minha conta, Ajuda, casca do painel |
| `requireTeamUser()` / `requireClientUser()` / `requireEnvironment(env)` | perfis daquele ambiente | áreas futuras |
| `requireProjectAccess("equipe" \| "cliente", projectId, ação)` | membro do projeto / conta vinculada ao cliente do projeto; senão **404** | páginas de detalhe das áreas futuras |
| `requireSessionUser()` | qualquer conta com sessão | só o que é da própria conta (trocar senha — inclusive `/conta/senha` —, encerrar sessões) |
| `authorizePermission(mod, ação)` | como `requirePermission`, respondendo **JSON 401/403** | Route Handlers |
| `authorize(request, ação)` (`painel/api/media/guard.ts`) | `arquivos:<ação>` + mesma origem | API de upload |

Semântica: sem sessão → `/login`; troca de senha pendente → tela de troca (`/painel/conta/senha` para quem entra
no painel; `/conta/senha` para os demais); sem a permissão → início do painel (como `requireAdmin` sempre fez)
ou, para quem não tem acesso integral, `/login?aviso=sem-acesso` (a tela de login mostra o aviso e o botão de
volta ao ambiente da pessoa); quem é de outro ambiente vai para o ambiente dele quando existir.

Por que `requireUser()` é mais estreito do que "qualquer conta do painel": a visão geral soma o financeiro, a
ficha do cliente mistura propostas, contratos e lançamentos. Uma página que usa `requireUser()` continua fechada
para perfis restritos (falha fechada); as páginas dos módulos declaram módulo e ação.

**Módulo inteiro × só os projetos da pessoa.** `canEverywhere()` = tem a permissão no módulo inteiro.
`canUsePanelModule()` = consegue abrir as telas do módulo: módulo inteiro, **ou** "nos projetos em que está"
quando o módulo já filtra por projeto. Hoje filtram por projeto **projetos** e **tarefas**
(`PROJECT_SCOPED_PANEL_MODULES`). Para o funcionário, a matriz também prevê agenda, conteúdo, arquivos e marca
"(P)", mas as telas desses módulos ainda exigem o módulo inteiro — ele fica **sem** elas (falha fechada; motivos
na seção 10).

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
- **Funcionário**: nunca o módulo inteiro. Não exclui, não compartilha com o cliente. **Nas telas de hoje o
  "(P)" vale em Projetos e Tarefas**; agenda, conteúdo, arquivos e marca "(P)" ainda não abrem para ele (seção
  10). `marca (P)` só passa a ter efeito quando a identidade visual for ligada a cliente/projeto (seção 14 do
  briefing).
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
- Tela: **Configurações › Usuários › Permissões** (`/painel/config/usuarios/[id]`): grade módulo × ação com o
  padrão do perfil, o resultado que vale (recalculado na hora com `permissionScope`, a mesma função do servidor) e,
  em cada célula, "Padrão / Permitir / Negar"; "Voltar ao padrão do perfil" apaga os ajustes.

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
- O banco guarda só o **SHA-256 do token**; o token aparece uma vez: no link do e-mail **e na tela de quem
  convidou** (retorno da action, com botão de copiar — sem SMTP é o único jeito de entregar o link). Validade:
  7 dias.
- **Convidar de novo** (`resendInviteAction` → `recreateInvite`): como o token antigo não existe mais, cria um
  convite novo com os mesmos dados e revoga o anterior. Vale para pendente, expirado e revogado; aceito não.
- **Nova conta** (senha temporária) ficou só para admin, sócio e técnico (`createUserAction` recusa os demais
  perfis): gestor, funcionário, freelancer e cliente nascem por convite.
- Convite de `cliente` exige a ficha do cliente; projeto só em convites de funcionário/freelancer.
- Um convite pendente por e-mail (criar outro revoga o anterior). E-mail que já tem conta não é convidado.
- Aceitar: nome + senha (mesma política de senha), **e-mail igual ao convidado**. Expirado, revogado, já
  usado, token desconhecido e e-mail divergente dão a mesma mensagem. O convite é gasto dentro da transação.
- A conta nasce com o perfil **do convite**, sem troca de senha obrigatória, e com os vínculos (ficha de
  cliente; membro do projeto só com "ver"). **Não abre sessão**: a pessoa entra pelo login.
- Limites: 30 convites/hora por quem convida; 10 tentativas de aceite a cada 15 min por IP.
- Auditoria: `convite_criado`, `convite_revogado`, `convite_aceito` (sem e-mail nem nome do convidado).
- A exportação de dados não inclui `user_invites`.
- Regra geral da exportação completa: tabela nova do schema entra sozinha, a menos que esteja em
  `EXPORT_EXCLUDED_TABLES` (`src/server/config/logic.ts`). O teste `config/dados/labels.test.ts` falha enquanto uma
  tabela nova não tiver rótulo (entra) nem exclusão (não entra) — a decisão é obrigatória.

Telas: **Configurações › Usuários** (aba Convites: pendentes, aceitos, expirados, revogados; "Convidar pessoa",
"Convidar de novo", "Revogar"), a ficha do cliente (bloco "Acessos do cliente") e o aceite público
`/convite?token=…` (`getPendingInvite` + `acceptInviteAction`; `X-Robots-Tag: noindex`, `referrer: no-referrer`).

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
- `moduleScope(user, mod, ação)`: em quais projetos a pessoa pode aquela ação do módulo — `"todos"`, a lista dos
  projetos em que é membro com a permissão correspondente (`can_view` + `can_edit`/`can_download`), ou `[]`.
  `scopeAllows(scope, projectId)`: o registro está no escopo? (registro sem projeto só entra em `"todos"`).
- `inScope(coluna, escopo)`: condição Drizzle para listas. Escopo vazio = nenhuma linha (nunca "todas").
- O cliente só **vê**. Baixar depende da liberação explícita de arquivos (galerias), que ainda não existe.
- Vínculo do perfil errado não vale: conta de cliente nunca é "membro"; só conta de cliente é vinculada a
  ficha. Revogar (tirar do projeto, desvincular, desativar a conta) vale na requisição seguinte.
- Estas funções devolvem ids e sim/não. Para o que um externo pode **ler**, use `getTeamProjectView` /
  `getClientProjectView`: listas de campos permitidos — sem notas internas, backup, links de trabalho,
  proposta de origem, financeiro, nem dados de outros membros ou de outros clientes.

Regra para as telas: **toda lista passa por `inScope`, todo detalhe por `requireProjectAccess` /
`requireProjectPermission` com o id lido do banco.** Conferir só o id da URL não basta.

**Telas dos vínculos (painel):**

- **Equipe do projeto** (`/painel/projetos/[id]`): quem vê é `equipe:ver`; quem inclui, ajusta e tira é
  `equipe:editar` (admin, sócio, gestor, técnico) — `addProjectMemberAction`, `updateProjectMemberAction`,
  `removeProjectMemberAction`. Só entram contas ativas de funcionário, freelancer ou gestor. O funcionário não vê
  o bloco.
- **Acessos do cliente** (`/painel/clientes/[id]`): `usuarios:ver` / `usuarios:editar` (admin, sócio) —
  convidar (convite de perfil cliente já com a ficha), vincular conta existente, desvincular
  (`linkClientUserAction`, `unlinkClientUserAction` em `config/usuarios/actions.ts`).

**O que o funcionário vê no painel** (membro com "ver"): lista de projetos (quadro e lista; sem a visão "Arquivos
e entregas"), o projeto (checklist, dados, prazos, nome do cliente sem link, tarefas; com "editar": etapa,
checklist e tarefas; com "baixar": os links dos arquivos) e as tarefas dos projetos dele. Não vê observações do
projeto, backup, proposta de origem, contratos, financeiro, agenda nem a equipe; não cria nem exclui projeto ou
tarefa fora dos projetos em que pode editar; não escolhe cliente nem passa tarefa para outra pessoa.

### 6.1 Compromisso particular: além da matriz

A matriz diz quem usa a Agenda; **dentro** dela, um compromisso `particular` só existe por inteiro para quem o
criou e para quem está nele (responsáveis e participantes). Para todas as outras pessoas — **inclusive admin e
sócio** — é "Ocupado": data, horário, repetição e dono. Função única: `toVisibleEvent` (`privacy.ts`).

Fora da tela da Agenda vale a mesma regra, porque ninguém mais lê a tabela `agenda_events`: tudo passa por
`src/server/agenda-related.ts`, que chama `listAgenda` / `getEventView` (séries expandidas, mascaramento aplicado).

| Onde | Particular de outra pessoa |
| --- | --- |
| Visão geral — "Compromissos da semana" | "Ocupado" no horário, com o nome do dono |
| Visão geral — "Próximas gravações e eventos" (filtro por categoria de produção) | não aparece |
| Ficha do cliente (próximos compromissos) e projeto (agenda do projeto) | **não aparece**: lista filtrada por cliente/projeto não devolve item mascarado (o filtro revelaria o vínculo) |
| Contagem do diálogo "Excluir cliente" | não conta (ao excluir, o compromisso só perde o vínculo, como os outros) |
| Anexo (`/media`) | 404 para quem não participa — mesmo com `arquivos:ver` |
| "Arquivo em uso" (`DELETE /painel/api/media/[id]`) | "um compromisso da agenda", sem título nem data |
| **Dados deste titular** (LGPD, `/painel/clientes/[id]/dados`) | conteúdo **não entra**; o arquivo avisa "resposta incompleta": quantos ficaram de fora e de quem são (sem data nem horário); a auditoria registra o número |
| **Exportação completa** (`/painel/config/dados/exportar`) | linha `oculto: true` com data, horário, repetição e dono; pessoas (`agenda_event_people`) e nome/descrição dos anexos (`media`) em branco; a auditoria registra quantos |
| Avisos e lembretes (`notifications`, `agenda_reminder_deliveries`) | o lembrete de um particular vai só para quem participa; as duas tabelas **não entram** na exportação completa (trariam título, local e participantes) |

Por que a exportação completa não leva tudo, sendo de administrador: (1) a promessa da tela é "os outros veem só
Ocupado", e os dois sócios são administradores — se o JSON trouxesse o conteúdo, um clique desfaria a regra; (2) o
JSON não é o caminho de restauração: a cópia integral é o **backup do servidor** (`npm run backup`, feito por quem
tem acesso à máquina, fora do painel); (3) quem exporta recebe inteiros os particulares de que participa, então
cada pessoa consegue levar os seus. Quem exporta sem enxergar a agenda recebe todo particular mascarado (falha
fechada).

Por que "dados deste titular" avisa em vez de calar: quem responde ao pedido (LGPD, art. 18) precisa saber que a
resposta está incompleta e a quem pedir o resto. É a única informação que sai sobre o compromisso (existe, é de
fulano, está ligado a este cliente), só para quem tem `dados:baixar`, e fica na auditoria.

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
| `projetos/actions.ts` | `projetos` | etapa, quadro e checklist → `requireScopedPermission("projetos","editar")` + `scopeAllows`; `addProjectTaskAction` → idem com `projetos:ver` + `tarefas:editar`; criar, editar o cadastro e excluir → módulo inteiro; equipe do projeto → `equipe:editar` |
| `tarefas/actions.ts` | `tarefas` | criar, editar, concluir → `requireScopedPermission("tarefas","editar")` + projeto da tarefa lido do banco; excluir → `tarefas:excluir` (módulo inteiro) |
| `agenda/actions.ts`, `agenda/config/actions.ts` | `agenda` | além da permissão, compromisso **particular** só é alterado por quem participa dele (`src/server/agenda`) |
| `conteudo/actions.ts` | `conteudo` | — |
| `financeiro/actions.ts` | `financeiro` | — |
| `marca/actions.ts` | `marca` | — |
| `site/**/actions.ts` | `site` | — |
| `config/propostas/actions.ts` | `config` | — |
| `config/notificacoes/actions.ts` | — | `requireAdmin()` (admin, sócio) |
| `config/usuarios/actions.ts` | `usuarios` | tudo `usuarios:editar` (inclui vincular/desvincular conta de cliente) |
| `conta/actions.ts` | — | `requireSessionUser()` (própria conta) |
| `kit/**/actions.ts` | — | `requireUser()` (demonstração do kit) |
| `src/lib/auth/actions.ts` | — | troca de senha: `requireSessionUser({ allowPasswordChange })` |
| `src/server/access/invite-actions.ts` | `usuarios` | aceite é público (convite válido) |

**Route Handlers**

| Rota | Exige |
| --- | --- |
| `GET /media/[...key]` (arquivo privado ou imagem fora do ar) | sessão do painel + módulo dono do arquivo: comprovante → `financeiro:baixar`; contrato → `contratos:baixar`; marca → `marca:baixar`; **anexo de compromisso → `agenda:ver` no módulo inteiro + ver o compromisso por inteiro** (anexo de particular: só quem participa); sem dono → quem enviou ou `arquivos:ver`; imagem pública não publicada → `site:ver`. Quem enviou o arquivo sempre o abre. Senão **404** |
| `POST /painel/api/media`, `PATCH /painel/api/media/[id]` | `arquivos:editar` + mesma origem |
| `DELETE /painel/api/media/[id]` | `arquivos:excluir` + mesma origem; **409** se o arquivo está em uso — inclusive como anexo da agenda (a mensagem diz "um compromisso da agenda", sem título nem data) |
| `GET /painel/orcamentos/[id]/pdf` | `propostas:ver`; com `?baixar=1`, `propostas:baixar` |
| `GET /painel/config/dados/exportar` | `dados:baixar`; compromissos particulares de outras pessoas saem mascarados (seção 6.1) |
| `GET /painel/clientes/exportar`, `GET /painel/clientes/[id]/dados` | `dados:baixar` + `clientes:ver`; em `/dados`, particulares de outras pessoas ficam de fora, com aviso (seção 6.1) |
| `GET /painel/financeiro/exportar` | `dados:baixar` + `financeiro:ver` |
| `GET /painel/site/metricas/exportar` | `dados:baixar` + `site:ver`; os números de leads só entram para quem tem `leads:ver` |
| `POST /api/visita` (medição de visitas do site) | **pública** (não é rota do painel): mesma origem, corpo ≤ 1 KB validado com zod, limite por IP; ignora robôs, pré-carregamento e quem tem sessão do painel. Só grava totais anônimos (`src/server/metrics`) |

### 7.2 Páginas (aplicado)

O `await` do topo de cada página é o guarda abaixo. A tabela é conferida por
`src/app/painel/pages-access.db.test.ts`: cada página é chamada com a sessão de cada perfil e precisa responder
como a tabela manda; página nova sem linha na tabela do teste faz o teste falhar.

| Página | Guarda |
| --- | --- |
| `_shell/shell.tsx` (casca) | `requirePanelUser({ allowPasswordChange: true })`; menu, atalhos do celular e contador de leads filtrados por `canUsePanelModule(user, módulo, "ver")` (`nav.ts`: cada item tem `module`) |
| `/painel` (visão geral) | `requirePanelUser()`; cartões, avisos, atalhos e listas por módulo (`dashboardAccess`): o que a pessoa não vê **não é consultado**; projetos e tarefas filtrados pelo escopo; os cartões da agenda exigem `agenda:ver` no **módulo inteiro** (`canEverywhere`) e leem por `listAgenda` (particular de outra pessoa: "Ocupado"); o indicador de visitas do site (hoje / 7 dias) exige `site:ver` |
| `/painel/[...resto]`, `/painel/ajuda`, `/painel/conta` | `requirePanelUser()` |
| `/painel/conta/senha` | `requirePanelUser({ allowPasswordChange: true })` |
| `/painel/leads`, `/leads/[id]` · `/leads/novo` | `leads:ver` · `leads:editar` |
| `/painel/clientes`, `/clientes/[id]` · `/clientes/novo`, `/[id]/editar` | `clientes:ver` · `clientes:editar` (na ficha, abas de propostas/projetos/contratos/financeiro/agenda/tarefas por `canEverywhere`; o que não pode ver não é consultado) |
| `/painel/orcamentos`, `/[id]`, `/modelos` · `/novo` | `propostas:ver` · `propostas:editar` (em `/[id]`, os lançamentos do financeiro só vão ao navegador para quem tem `financeiro:ver`) |
| `/painel/contratos`, `/[id]`, `/modelos`, `/modelos/[id]` · `/novo`, `/[id]/editar`, `/modelos/novo` | `contratos:ver` · `contratos:editar` |
| `/painel/projetos` · `/projetos/[id]` · `/novo`, `/[id]/editar` | `requireScopedPermission("projetos", "ver")` (lista com `inScope`) · `requireProjectPermission("projetos", "ver", id)` · `projetos:editar` (em `/[id]`, o cartão "Agenda do projeto" exige `agenda:ver` no módulo inteiro e não mostra particulares de outra pessoa) |
| `/painel/tarefas` | `requireScopedPermission("tarefas", "ver")` (lista com `inScope`) |
| `/painel/agenda`, `/agenda/[id]` · `/agenda/novo`, `/agenda/[id]/editar`, `/agenda/config` | `agenda:ver` · `agenda:editar`. Em `/agenda/[id]`, compromisso particular de outra pessoa abre só como "Ocupado"; `/agenda/[id]/editar` responde **404** para quem não participa dele. `/agenda/config` (categorias, agendas, modelos de checklist) é de quem edita a agenda: as actions de `agenda/config/actions.ts` usam `agenda:editar` (excluir modelo: `agenda:excluir`) |
| `/painel/conteudo`, `/conteudo/[id]` · `/conteudo/novo` | `conteudo:ver` · `conteudo:editar` |
| `/painel/financeiro`, `/financeiro/[id]` · `/novo`, `/novo/parcelas` | `financeiro:ver` · `financeiro:editar` |
| `/painel/marca`, `/marca/[id]` · `/marca/novo` | `marca:ver` · `marca:editar` |
| `/painel/site/**` (listas, inclusive `/site/inicio` — ordem e visibilidade das seções da página inicial) · `/novo`, `/[id]`, `/textos/[secao]` | `site:ver` · `site:editar` (em `/site/inicio` a lista abre para quem vê; setas, arrastar, chave e "restaurar" só aparecem para quem edita, e as actions de `site/inicio/actions.ts` exigem `site:editar`) |
| `/painel/site/banners` (carrossel da página inicial) · `/banners/novo`, `/banners/[id]` | `site:ver` · `site:editar`. Na lista, setas, arrastar, chave, "Duplicar" e "Editar" só aparecem para quem edita, e "Excluir" para quem tem `site:excluir`; as actions de `site/banners/actions.ts` exigem `site:editar` (salvar, ligar/desligar, ordenar, duplicar) ou `site:excluir`. Imagens e vídeos entram pela API de mídia (`arquivos:editar`); a arte de um banner desligado ou encerrado só é entregue por `/media` a quem está logado no painel |
| `/painel/site/metricas` (visitas, origem, páginas, aparelhos, cliques, formulários) | `site:ver`; os blocos de leads (leads recebidos, serviços mais procurados) só aparecem — e só são consultados — com `leads:ver`; os botões de CSV, com `dados:baixar`; "Configurar" o contador, com `site:editar` |
| `/painel/config`, `/config/propostas` | `config:ver` |
| `/painel/config/notificacoes` | `requireAdmin()` |
| `/painel/config/usuarios`, `/config/usuarios/[id]` (permissões) | `usuarios:ver` (botões e actions: `usuarios:editar`) |
| `/painel/config/auditoria` | `auditoria:ver` |
| `/painel/config/dados` | `dados:baixar` |
| `/painel/kit/**` | `requireUser()` (demonstração; fica como está) |
| `(auth)/login/page.tsx` | `getSessionUser()` + `landingFor(user)`; avisos `?aviso=sem-acesso`, `conta-criada`, `senha-redefinida`, `senha-criada` |
| `(auth)/convite/page.tsx` | pública; só mostra o formulário com `getPendingInvite(token)` válido |
| `(auth)/conta/senha/page.tsx` | `requireSessionUser({ allowPasswordChange: true })` — troca de senha de quem não entra no painel |

Ajustes de interface aplicados (não são barreira de segurança — o servidor já barra):

- Nenhuma tela compara `user.role === "admin"`: usa-se `isAdminRole(role)` ou `canEverywhere(user, módulo, ação)`
  (a conta `socio` vê os mesmos botões e abas que `admin`).
- Botões de criar/editar/excluir e links para outros módulos só aparecem para quem pode a ação (ficha do
  cliente, projeto, proposta, tarefas, configurações, visão geral).
- "Observações internas" da ficha do cliente (a tela promete "só os sócios veem"): só para quem tem acesso
  integral (`seesInternalNotes`); o gestor não as vê nem as altera ao salvar o cadastro.
- `getUserOptions()` ("responsável") lista só perfis do painel — contas de freelancer e de cliente não aparecem.

### 7.3 Áreas futuras

- `/equipe/**`: `requireTeamUser()`; detalhe de projeto com `requireProjectAccess("equipe", id, ação)`; leitura
  por `getTeamProjectView` / `listTeamProjectViews`.
- `/cliente/**`: `requireClientUser()`; `requireProjectAccess("cliente", id)`; leitura por
  `getClientProjectView` / `listClientProjectViews`.
- O `proxy.ts` já cobre `/equipe/:path*` e `/cliente/:path*` (sem cookie → login; API → 401 JSON).
- `X-Robots-Tag: noindex, nofollow` já vale para `/equipe/**`, `/cliente/**`, `/convite` e `/conta/**`
  (`next.config.ts`), e o `robots.txt` os desautoriza.

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
| `src/server/agenda-related.db.test.ts` | **sentinelas**: um compromisso particular (ligado a cliente e projeto, com anexo) não chega a outra administradora pela visão geral, ficha do cliente, projeto, contagem de exclusão, "dados deste titular", exportação completa, `/media` nem pela mensagem de "arquivo em uso"; quem participa vê; séries expandidas; nenhum arquivo fora da agenda lê `agenda_events` (lista fechada) |
| `src/server/agenda/agenda.db.test.ts`, `privacy.test.ts` | a mesma privacidade dentro da agenda (consultas, conflitos, actions) |
| `src/app/painel/actions-access.db.test.ts` | todas as Server Actions do painel × perfis (lista fechada das que aceitam escopo por projeto) |
| `src/app/painel/pages-access.db.test.ts` | **todas as páginas do painel × perfis**: tabela página → guarda (renderiza, redireciona ou 404), sem sessão, senha provisória; proposta: gestor não recebe o financeiro |
| `src/app/painel/funcionario-scope.db.test.ts` | funcionário × projeto alheio/inexistente/só-ver/tarefa sem projeto: páginas, listas, visão geral e todas as actions de projeto e tarefa; equipe do projeto; revogação na requisição seguinte |
| `src/server/config/permissions.db.test.ts` | último admin/sócio; `setUserPermissions` |
| `src/proxy.test.ts` | matcher dos três ambientes |

Apoio: `src/test/accounts.ts` (`makeAccount(perfil)` cria conta + sessão no banco de teste).

## 9. Banco

Migration `drizzle/0001_perfis_e_permissoes.sql` (só acrescenta): tabelas `project_members`, `client_users`,
`user_invites` e a coluna `users.permissions`. `users.role` é texto sem `CHECK`: os perfis novos não exigem
migration. `npm run db:seed -- --dev --demo` cria uma conta de exemplo por perfil novo
(`gestor@`, `funcionario@`, `freelancer@`, `cliente@nos.local`) e as liga ao projeto e ao cliente de exemplo.

## 10. Pendências conhecidas

- **Funcionário sem agenda, conteúdo, marca e arquivos** (falha fechada; a matriz prevê "(P)"):
  - `agenda`: o alcance por projeto é calculado dentro da própria agenda (`src/server/agenda/access.ts`, em
    andamento) e só vale quando `"agenda"` entrar em `PROJECT_SCOPED_PANEL_MODULES`. Mesmo depois disso, três
    pontos **de fora da agenda** continuam exigindo o módulo inteiro (`canEverywhere(user, "agenda", "ver")`),
    por falha fechada, até decisão em contrário: os cartões da visão geral (`dashboardAccess`), o cartão "Agenda
    do projeto" e os anexos em `/media`.
  - `conteudo` e `marca`: `content_items` e `brand_assets` **não têm coluna de projeto** — não há como filtrar.
    Precisa de migration (`project_id`) e de decisão dos sócios sobre o vínculo.
  - `arquivos`: `POST /painel/api/media` exige `arquivos:editar` no módulo inteiro; o envio por projeto
    (`can_upload`) fica para a Área da Equipe.
- **Opções de outros módulos em formulários**: quem edita projetos/tarefas/propostas vê a lista de clientes nos
  campos de seleção mesmo com um ajuste individual negando `clientes:ver` (os perfis padrão não têm esse caso; o
  funcionário não recebe essas listas).
- **Freio `RESTRICTED_PANEL_READY = false`** fecha o login dos perfis restritos, mas não derruba sessões já
  abertas (desative a conta ou mude o perfil para encerrá-las).
- **Autenticação em dois fatores**: fora desta etapa.
- **Área da Equipe e Área do Cliente**: seção 7.3.
