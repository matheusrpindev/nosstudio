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
src/app/(site)/…            páginas públicas: /, /sobre, /servicos, /pacotes, /casamentos, /portfolio, /contato, /privacidade
src/app/(auth)/…            /login, /recuperar-senha, /redefinir-senha
src/app/painel/…            painel (protegido). Um diretório por módulo.
src/app/media/[...key]/     entrega de uploads
src/components/brand/       <Logo /> e motivos da marca
src/components/ui/          kit do painel (ver src/components/ui/README.md)
src/components/site/        componentes do site público
src/db/schema.ts            schema (fonte da verdade do banco)        src/db/index.ts   → `db`
src/lib/domain.ts           enums + rótulos pt-BR (fonte única)       src/lib/format.ts, dates.ts → formatação
src/lib/site/content.ts     modelo + padrões do conteúdo editável     src/lib/settings.ts → configs internas
src/lib/auth/               sessão, senha, limitador de tentativas, actions de login
src/server/…                código só-servidor: site/queries.ts (leitura pública com cache), action.ts (helpers de
                            Server Action), settings.ts, e um arquivo/pasta por módulo do painel
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
  - **Painel**: `src/app/painel/layout.tsx` já envolve tudo em `<Suspense>` e exporta `instant = false`. As páginas
    do painel são `async`, começam com `await requireUser()` e leem o banco direto (sem cache).
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

- **Toda** página, Server Action e Route Handler do painel começa com `await requireUser()` (ou `requireAdmin()`),
  de `@/lib/auth`. O proxy não é barreira de segurança. Actions revalidam tudo que vem do cliente com zod.
- Route Handlers que alteram dados conferem `isSameOrigin(request)` (`@/lib/request`).
- **Custos internos, margens, notas internas e descontos não aprovados de propostas nunca saem do painel** — o PDF
  e qualquer página pública recebem apenas um objeto "público" montado por uma função única e testada.
- Nada de `dangerouslySetInnerHTML` com conteúdo vindo do banco. Texto rico = markdown via `<Markdown>`.
  Links vindos de formulário passam por `safeHref`/`safeUrl`.
- Uploads: só pelo pipeline de `src/server/media` (valida tipo real, reencoda imagens, nomes aleatórios).
  Arquivos privados (contratos, comprovantes) só são servidos com sessão.
- Registre ações relevantes com `logAudit()` (`@/lib/audit`). Nunca grave senha/token em log.
- LGPD: dados de leads/clientes só no painel; consentimento registrado com data e versão da política.

## Conteúdo do site (regras dos sócios)

- Nada inventado: sem clientes, projetos, depoimentos, números, prêmios, ano de fundação ou preços fictícios.
- Pacotes: "Sob consulta" até os sócios cadastrarem valores; quantidades só aparecem quando preenchidas.
- Portfólio e depoimentos começam ocultos; blocos sem conteúdo publicado **não renderizam** (nem título, nem link).
- FAQ: só perguntas publicadas e com resposta.
- Sem WhatsApp configurado, os botões de WhatsApp não aparecem (o formulário continua funcionando).
- Todo texto visível do site vem de `getSiteContent()` (editável no painel) — não deixe copy fixa no JSX, exceto
  rótulos de interface (ex.: "Abrir menu").

## Interface

- Paleta oficial (tokens Tailwind): `roxo #3B1F8E`, `lima #C6F432`, `lavanda #CFC6FF`, `offwhite #F6F4EF`,
  `grafite #1B1B22`. Fonte única: Montserrat. Lima nunca como texto sobre fundo claro (contraste).
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
