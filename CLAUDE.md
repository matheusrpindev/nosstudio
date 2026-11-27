# NÓS Studio — site institucional + painel de gestão

Site público e painel administrativo da NÓS Studio (marketing, conteúdo e audiovisual; fundadores Pedro Henrique
e Laura Nepomuceno). Requisitos completos em `docs/briefing/` — `briefing-socios.md` (copy e desejos dos sócios) e
`briefing-tecnico.txt` (versão técnica: rotas, campos, critérios de aceite).

@AGENTS.md

## Stack

Next.js 16.4 (App Router, **Cache Components**, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 (CSS-first,
`src/app/globals.css`) · Drizzle ORM + libSQL/SQLite · zod 4 · Radix UI (`radix-ui`) · lucide-react · date-fns ·
react-markdown · sharp · nodemailer · @node-rs/argon2. Idioma da interface, dos comentários e das mensagens:
**pt-BR**. Identificadores de código em inglês.

**Este Next.js não é o que você conhece.** Antes de usar qualquer API do Next, leia o guia correspondente em
`node_modules/next/dist/docs/01-app/` (ex.: `01-getting-started/08-caching.md`, `09-revalidating.md`,
`02-guides/authentication-with-cache-components.md`, `02-guides/forms.md`).

## Estrutura

```
src/app/(site)/…            páginas públicas: /, /sobre, /servicos, /servicos/[slug], /planos, /eventos-e-casamentos, /portfolio,
                            /contato, /privacidade, /termos, /cookies (rotas antigas /pacotes e /casamentos: redirects em next.config.ts)
src/app/(auth)/…            /login, /recuperar-senha, /redefinir-senha, /convite (aceite), /conta/senha (troca fora do painel)
src/app/painel/…            painel (protegido). Um diretório por módulo.
src/app/media/[...key]/     entrega de uploads
src/components/brand/       <Logo /> e motivos da marca
src/components/ui/          kit do painel (ver src/components/ui/README.md)
src/components/site/        componentes do site público
src/db/schema.ts            schema (fonte da verdade do banco)        src/db/index.ts   → `db`
src/lib/domain.ts           enums + rótulos pt-BR (fonte única)       src/lib/format.ts, dates.ts → formatação
src/lib/site/content.ts     modelo + padrões do conteúdo editável     src/lib/settings.ts → configs internas
src/lib/site/home-layout.ts ordem e visibilidade das seções da home   src/lib/site/paths.ts → caminhos das páginas públicas
src/lib/auth/               sessão, senha, limitador de tentativas, actions de login, GUARDAS (`require…`)
src/lib/permissions/        perfis, ambientes e matriz módulo × ação (puro; serve no cliente e no servidor)
src/server/access/          escopo por projeto/cliente, membros, convites (a parte de permissões com banco)
src/server/…                código só-servidor: site/queries.ts (leitura pública com cache), action.ts (helpers de
                            Server Action), settings.ts, e um arquivo/pasta por módulo do painel
src/lib/metrics/ + src/server/metrics/   medição própria de visitas (regras puras + coleta/consultas); entrada: /api/visita
scripts/                    migrate.ts, seed.ts, create-user.ts
```

## Regras do Next 16 que valem aqui

- `cookies()`, `headers()`, `params` e `searchParams` são **assíncronos** (`await`). Tipar props de página à mão:
  `{ params }: { params: Promise<{ id: string }> }`, `searchParams: Promise<Record<string, string | string[] | undefined>>`.
- Middleware agora é `src/proxy.ts` (já existe; só faz redirecionamento otimista do `/painel`).
- **Cache Components está ligado.** Consequências:
  - Em Server Components, ler banco/cookies/`searchParams` fora de `"use cache"` exige estar dentro de um
    `<Suspense>`; `new Date()`, `Date.now()`, `Math.random()`, `crypto.randomUUID()` durante o pré-render quebram o
    build — só depois de ler cookies/`await connection()`, dentro de `"use cache"`, ou no cliente.
  - **Site público**: nunca consulte o banco direto na página. Use as funções de `src/server/site/queries.ts`
    (todas `"use cache"` + tag `site`). As páginas ficam estáticas e o painel as atualiza com `invalidateSite()`.
  - **Painel**: `src/app/painel/layout.tsx` já envolve tudo em `<Suspense>`. **Toda página do painel exporta
    `export const instant = false`** (o do layout não cobre segmentos filhos; sem isso o Next acusa "uncached data
    outside of <Suspense>" nas navegações), é `async`, começa pelo GUARDA dela (ver Segurança) e lê o banco direto
    (sem cache). Todo guarda (`requirePermission`, `requirePanelUser`…)
    já chama `connection()` por dentro (a sessão depende do horário), então depois dele `todayISO()`/`new Date()`
    são seguros. Ler só `cookies()` NÃO basta: o Next pré-renderiza a "casca" por sessão e acusa `new Date()`.
    Página pública que depende do horário (ex.: `/convite`, validade do convite) chama `await connection()`.
  - Não use `export const dynamic/revalidate/fetchCache` (não existem com Cache Components) nem `unstable_cache`.
- Depois de uma mutação numa Server Action: `refresh()` (de `next/cache`) para atualizar a tela atual, ou
  `redirect()`. Se a mudança aparece no site público: `invalidateSite()` (de `@/server/site/cache`).

## Dados

- Dinheiro em **centavos** (integer). Datas de calendário como texto `YYYY-MM-DD`; horários `HH:mm`; instantes
  como `timestamp_ms`. "Hoje" vem de `todayISO()` (fuso do estúdio), nunca de `new Date().toISOString()`.
- Enums e rótulos vivem em `src/lib/domain.ts`. Não crie listas de status soltas em componentes.
- Formatação sempre pelos helpers: `formatBRL`, `parseBRL`, `formatDate`, `formatPhone`, `whatsAppLink`, `safeHref`…
- Mudou o schema? `npm run db:generate` (gera migration em `drizzle/`) e `npm run db:migrate`. Nunca edite uma
  migration já commitada.
- IDs de registros são inteiros; URLs do painel usam o id (`/painel/clientes/12`).

## Segurança (inegociável)

- **Perfis e ambientes** (fonte: `src/lib/permissions`, documentação e tabelas em `docs/permissoes.md`): sete
  perfis (admin, sócio, gestor, funcionário, freelancer, cliente, técnico) e três ambientes privados — Painel
  (`/painel`), Área da Equipe (`/equipe`) e Área do Cliente (`/cliente`; as duas últimas ainda sem telas). Cada
  perfil só entra no(s) seu(s) ambiente(s); freelancer e cliente NUNCA entram no painel. Sem cadastro público:
  conta nova nasce por convite (`/convite`) ou em Configurações › Usuários.
- **Toda** página, Server Action e Route Handler do painel começa (primeiro `await`) por um guarda de
  `@/lib/auth` ou `@/server/access`. O proxy não é barreira de segurança; esconder botão/menu é só cortesia.
  Actions revalidam tudo que vem do cliente com zod. Qual guarda usar:
  - `requirePermission("módulo", "ação")` — o padrão: página ou action de UM módulo, para quem tem a permissão no
    módulo inteiro. Ações: `ver`, `editar`, `excluir`, `baixar`, `compartilhar` (páginas de lista/detalhe = `ver`;
    formulários de criar/editar e actions = `editar`; `delete…` = `excluir`).
  - `requireScopedPermission(mod, ação)` (`@/server/access`) — só nos módulos que filtram por projeto
    (`PROJECT_SCOPED_PANEL_MODULES`: projetos, tarefas, agenda). Passa também quem tem a permissão "nos projetos em que
    está" (funcionário) e devolve o ESCOPO, que é obrigatório usar: listas com `inScope(coluna, scope)`, registros
    com `scopeAllows(scope, projectId LIDO DO BANCO)`.
  - `requireProjectPermission(mod, ação, projectId)` — página de detalhe de um registro de projeto.
  - `requirePanelUser()` — páginas comuns a qualquer conta do painel (visão geral, Minha conta, Ajuda, casca); o
    que elas mostram de cada módulo é condicionado a `canEverywhere`/`canUsePanelModule` e NEM É CONSULTADO para
    quem não pode ver.
  - `requireAdmin()` — só admin e sócio (notificações). `requireUser()` (acesso integral) ficou só para o kit.
  - `requireSessionUser()` — só o que é da PRÓPRIA conta (trocar senha, sessões), de qualquer ambiente.
  - Futuras `/equipe/**` e `/cliente/**`: `requireTeamUser()` / `requireClientUser()` +
    `requireProjectAccess(ambiente, id)`, lendo dados só pelas visões de `src/server/access/projects.ts`.
- Nunca compare `user.role === "admin"`: use `isAdminRole(role)` ou `can…(user, módulo, ação)` (a conta `socio`
  vê o mesmo que `admin`). Uma página que junta módulos (ficha do cliente, projeto, proposta, visão geral) mostra
  cada bloco só a quem vê o módulo dele — inclusive nas props passadas a Client Components (vão para o navegador).
- Página nova do painel: declare o guarda na tabela de `src/app/painel/pages-access.db.test.ts` e em
  `docs/permissoes.md` (o teste falha sem isso); item de menu novo leva `module` em `painel/nav.ts`.
- Route Handlers do painel ficam em `src/app/painel/api/**` e começam com `authorize(request, ação)` de
  `src/app/painel/api/media/guard.ts` (sessão + permissão + mesma origem; responde 401/403 em JSON — os `require…`
  redirecionam e não servem para APIs). Os demais usam `authorizePermission(módulo, ação)`.
- **Custos internos, margens, notas internas e descontos não aprovados de propostas nunca saem do painel** — o PDF
  e qualquer página pública recebem apenas um objeto "público" montado por uma função única e testada.
- Nada de `dangerouslySetInnerHTML` com conteúdo vindo do banco. Texto rico = markdown via `<Markdown>`.
  Links vindos de formulário passam por `safeHref`/`safeUrl`.
- Uploads: só pelo pipeline de `src/server/media` (valida tipo real, reencoda imagens, nomes aleatórios).
  Arquivos privados (contratos, comprovantes) só são servidos com sessão.
- Registre ações relevantes com `logAudit()` (`@/lib/audit`). Nunca grave senha/token em log.
- LGPD: dados de leads/clientes só no painel; consentimento registrado com data e versão da política.
- Medição de visitas (método em `src/server/metrics/collect.ts`): própria, **sem serviço de terceiros, sem cookie e
  sem gravar IP nem user-agent** — só o código do visitante do dia (HMAC com sal diário, apagado na virada) e totais
  agregados em `visit_stats`. Não acrescente identificador persistente, script de analytics externo nem campo novo
  ao sinal sem atualizar as políticas de Privacidade/Cookies (padrões em `src/lib/site/content.ts`) e a versão.

## Conteúdo do site (regras dos sócios)

- Nada inventado: sem clientes, projetos, depoimentos, números, prêmios, ano de fundação ou preços fictícios.
- Planos: sem preços nem quantidades até os sócios publicarem — no lugar do valor entra o texto de
  `packagesPage.priceOnRequestLabel` ("Investimento personalizado para o seu negócio."); quantidades só aparecem
  quando preenchidas. A tabela comparativa sai do "O que inclui" de cada plano (`src/lib/site/plans.ts`).
- Serviços: cada serviço publicado tem página própria (`/servicos/[slug]`). Benefícios, FAQ do serviço e trabalhos
  relacionados nascem vazios e só renderizam quando preenchidos no painel.
- Página inicial: a ordem e a visibilidade das seções vêm de `getHomeLayout()` (Editar site › Página inicial).
- Formulários: o envio vira lead com os campos do tipo do pedido (`buildLeadRecord`); o de Eventos e Casamentos
  NÃO cria compromisso na agenda nem promete data.
- Portfólio e depoimentos começam ocultos; blocos sem conteúdo publicado **não renderizam** (nem título, nem link).
- Portfólio: o que vai para o site sai SÓ de `toPublicProject` (`src/lib/site/portfolio.ts`) — nome do cliente apenas
  com `showClient`; bloco do estudo de caso vazio não renderiza; `origin = experiencia_anterior` sempre leva selo e
  aviso. Publicar exige capa e texto alternativo em todas as imagens (`publishBlockers`) e é sempre ato manual dos
  sócios: nenhum arquivo de projeto/equipe entra no portfólio automaticamente. A ordem do painel é a ordem do site.
- FAQ: só perguntas publicadas e com resposta.
- Sem WhatsApp configurado, os botões de WhatsApp não aparecem (o formulário continua funcionando).
- Contador de visitas do rodapé: só o número real de `getPublicVisitCount()`, com a métrica na legenda; nasce
  desligado (Textos › Contador de visitas). Clique medido = `data-track="<tipo>:<alvo>"` (`whatsapp:<onde>`,
  `banner:<id>`); guia em `src/components/site/README.md`.
- Todo texto visível do site vem de `getSiteContent()` (editável no painel) — não deixe copy fixa no JSX, exceto
  rótulos de interface (ex.: "Abrir menu").

## Interface

- Paleta oficial (tokens Tailwind, valor fixo em qualquer tema): `roxo #3B1F8E`, `lima #C6F432`, `lavanda #CFC6FF`,
  `offwhite #F6F4EF`, `grafite #1B1B22`, `preto #101014`. Fonte única: Montserrat.
- **Dois temas, um arquivo de tokens** (`src/app/globals.css`):
  - **Site público = claro.** Lima nunca como texto sobre fundo claro (contraste). Não mexa na aparência do site ao
    mexer no painel: `.btn`, `.input`, `.prosa` etc. são compartilhadas — os tokens semânticos têm no `@theme` os
    valores claros de sempre.
  - **Painel e telas de acesso = escuro** ("fundo preto, detalhes em roxo, destaques em lima"). Escopo: a classe
    `tema-painel` na raiz de `painel/_shell/shell.tsx` (e no `ShellFallback`) e de `(auth)/layout.tsx`; o seletor
    `:root:has(.tema-painel)` troca os tokens semânticos no documento inteiro (fundo do `<body>`, `color-scheme`,
    portais do Radix). Só em `@media screen` — a impressão de contrato sai clara. Novo layout fora desses dois que
    deva ser escuro precisa da classe na raiz.
  - Tokens semânticos (claro → escuro): `fundo` (offwhite → preto), `superficie` (branco → grafite),
    `superficie-alta` (→ `#26262F`), `campo` (→ `#131318`), `borda`/`borda-forte` (→ `#30303C`/`#727084`),
    `texto`/`texto-suave` (→ `#F6F4EF`/`#A7A4B3`), `detalhe` (roxo → `#B9A8FF`: o roxo oficial não tem contraste
    sobre preto), `detalhe-suave`/`detalhe-medio` (→ `#2B2056`/`#4A3A9C`), `primaria` + `sobre-primaria`
    (roxo + branco → **lima + grafite**), `foco` (→ lima), `menu` (→ `#17112C`, borda roxo), `inverso`, `veu`,
    `sucesso`/`perigo`/`alerta` + `*-claro` + `perigo-solido`.
  - No painel, **cor só por token semântico** (`text-texto`, `bg-superficie`, `border-borda`, `text-detalhe`,
    `bg-primaria text-sobre-primaria`…). A paleta fixa entra só como preenchimento com o texto certo por cima
    (`bg-lima text-grafite`, `bg-roxo text-white`, texto branco/lavanda sobre `bg-menu`). Nada de hex em componente,
    `text-roxo`, `text-grafite` solto, `bg-white`, `text-cinza`, `border-areia`. Tabela completa e o que não usar:
    `src/components/ui/README.md` ("Cores e tema").
  - Prévias do site e amostras da marca dentro do painel mostram as cores reais: paleta fixa ou um bloco
    `className="tema-claro"` (devolve os tokens claros naquele trecho), sempre com borda.
- Mobile-first de verdade: o painel precisa ser operável no celular (alvos ≥ 44px, inputs com fonte ≥ 16px,
  tabelas viram listas). Acessibilidade: rótulos, foco visível, navegação por teclado, `prefers-reduced-motion`.
- `<Logo />` é Server Component (traçados pesados): em Client Components, receba o logo via `children`/prop.

## Verificação

```
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run test           # vitest (testes unitários em src/**/*.test.ts)
npm run db:setup       # migrate + seed          (seed -- --dev --demo: contas de teste e dados [Exemplo])
npm run dev            # http://localhost:3000   (contas dev: pedro@nos.local / laura@nos.local — nosstudio-dev-2026)
```
