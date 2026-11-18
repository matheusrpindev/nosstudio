# NÓS Studio — site institucional + painel de gestão

Site público e área administrativa da **NÓS Studio** (marketing, conteúdo e audiovisual), dos sócios Pedro Henrique e
Laura Nepomuceno. *Sua história, nosso olhar.*

O projeto tem dois ambientes no mesmo aplicativo:

- **Site público** — apresenta a marca, capta pedidos de orçamento e pode ser editado pelos sócios sem programar.
- **Painel privado** (`/painel`) — leads, clientes, orçamentos em PDF, agenda, projetos, financeiro, contratos,
  calendário de conteúdo, biblioteca da marca e o editor do próprio site.

Os requisitos originais estão em [`docs/briefing/`](docs/briefing).

## O que está pronto

**Site público**

| Página | Caminho | Observações |
| --- | --- | --- |
| Início | `/` | Hero, serviços em destaque, fundadores, como funciona, pacotes, FAQ e formulário |
| Quem Somos | `/sobre` | História do casal, fundadores, propósito, valores |
| Serviços | `/servicos` | Fotografia, vídeo, marketing, eventos, casamentos |
| Pacotes | `/pacotes` | Começo, Presença, Destaque e serviços avulsos ("Sob consulta" até os sócios definirem valores) |
| Casamentos | `/casamentos` | Abordagem, o que a cobertura pode incluir, formulário de evento |
| Portfólio | `/portfolio` | Oculto no lançamento; aparece quando houver projetos publicados |
| Contato | `/contato` | Formulário de orçamento com consentimento (LGPD), WhatsApp e Instagram |
| Privacidade | `/privacidade` | Texto-base editável (revisar com assessoria jurídica) |

Também: barra de avisos configurável, sitemap, robots, imagem de compartilhamento, dados estruturados e ícones.
Seções sem conteúdo publicado (portfólio, depoimentos, FAQ sem resposta) não aparecem — nada de bloco vazio.

**Painel**

| Módulo | Caminho | O que faz |
| --- | --- | --- |
| Visão geral | `/painel` | Leads novos, orçamentos aguardando, entregas, pagamentos, compromissos da semana |
| Leads | `/painel/leads` | Pedidos vindos do site (origem, data, consentimento); converter em cliente |
| Clientes | `/painel/clientes` | Cadastro, funil em quadro, histórico de atendimento, vínculos, CSV |
| Orçamentos | `/painel/orcamentos` | Itens, cálculo interno de custos e margem, sinal e parcelas, modelos, versões, **PDF** |
| Agenda e tarefas | `/painel/agenda`, `/painel/tarefas` | Calendário de gravações, eventos e prazos; lista de tarefas |
| Projetos | `/painel/projetos` | Etapas, checklist, links de arquivos e entregas, situação do backup |
| Financeiro | `/painel/financeiro` | Previsto × realizado, contas a receber/pagar, reserva de caixa, CSV |
| Contratos | `/painel/contratos` | Modelos e documentos, arquivo assinado (privado) |
| Conteúdo | `/painel/conteudo` | Calendário editorial: ideia → roteiro → gravação → edição → aprovação → publicado |
| Marca | `/painel/marca` | Logos, paleta, fontes e links dos materiais |
| Editar site | `/painel/site` | Textos, fotos, avisos, serviços, pacotes, FAQ, portfólio, depoimentos, visibilidade, SEO |
| Configurações | `/painel/config` | Usuários, notificações, padrões de proposta, exportação de dados, auditoria |

> **Regra de segurança do PDF:** custos internos, margem, notas internas e descontos não aprovados nunca saem do
> painel. O PDF é montado só a partir de uma "visão pública" da proposta (`src/lib/proposals/public.ts`), coberta por
> testes que falham se qualquer valor interno escapar.

## Tecnologia

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM + SQLite/libSQL ·
zod · Radix UI · @react-pdf/renderer · sharp · Argon2id. Sem serviços pagos obrigatórios: banco e arquivos ficam em
disco, sob controle da NÓS.

## Rodando localmente

Requer Node.js 22 ou mais recente.

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:setup
```

```bash
npm run db:seed -- --dev --demo
```

```bash
npm run dev
```

- Site: <http://localhost:3000> · Painel: <http://localhost:3000/login>
- `db:setup` cria o banco (`data/nos.db`) e o conteúdo inicial (serviços, pacotes, FAQ em rascunho, avisos, modelos
  de proposta). Pode rodar quantas vezes quiser: só preenche o que está vazio.
- `db:seed -- --dev --demo` é **só para desenvolvimento**: cria as contas `pedro@nos.local` e `laura@nos.local`
  (senha `nosstudio-dev-2026`) e dados marcados como `[Exemplo]` para testar os fluxos.

## Contas do painel (produção)

Não existe cadastro público. As contas são criadas pela linha de comando ou em **Painel → Configurações → Usuários**.

```bash
npm run user:create -- --name "Pedro Henrique" --email pedro@seudominio.com.br
```

```bash
npm run user:create -- --name "Laura Nepomuceno" --email laura@seudominio.com.br
```

O comando mostra uma senha temporária uma única vez; no primeiro acesso o sistema exige uma senha nova.
Para o desenvolvedor, use `--role tecnico` (conta temporária) e, ao final, revogue com
`npm run user:create -- --email dev@dominio.com.br --deactivate`. Para gerar nova senha: `--reset`.

## Variáveis de ambiente

| Variável | Para quê | Padrão |
| --- | --- | --- |
| `SITE_URL` | URL pública (links de e-mail, sitemap, compartilhamento) | `http://localhost:3000` |
| `APP_SECRET` | Segredo da aplicação — **obrigatório em produção** (`openssl rand -base64 48`) | — |
| `DATABASE_URL` | Banco. Arquivo local ou `libsql://…` (Turso) | `file:./data/nos.db` |
| `DATABASE_AUTH_TOKEN` | Token do banco remoto, se houver | — |
| `UPLOAD_DIR` | Pasta dos arquivos enviados (precisa ser persistente) | `./data/uploads` |
| `APP_TIMEZONE` | Fuso do estúdio (agenda, prazos, avisos) | `America/Sao_Paulo` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | E-mail de recuperação de senha e aviso de novo lead | — |
| `TRUSTED_PROXIES` | Quantos proxies ficam na frente do app (Nginx/Caddy/Cloudflare = 1) | `1` |

Sem SMTP configurado o sistema funciona, mas os e-mails só aparecem no log do servidor (o link de redefinição de
senha também). Nesse caso, use `npm run user:create -- --email … --reset` para redefinir uma senha.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start:prod` | Build e inicialização de produção (migra o banco e renova o cache do site) |
| `npm run db:setup` | Migrations + conteúdo inicial |
| `npm run db:generate` | Gera uma migration depois de alterar `src/db/schema.ts` |
| `npm run user:create` | Cria, redefine ou desativa contas |
| `npm run backup` / `npm run restore` | Backup e restauração (banco + uploads) |
| `npm run typecheck` · `npm run lint` · `npm run test` | Verificações |

## Publicação

O domínio, a hospedagem e as contas devem ficar em nome da NÓS Studio.

**Recomendado — servidor próprio (VPS) com Docker.** Um servidor pequeno basta. O repositório traz `Dockerfile` e
`docker-compose.yml`; os dados ficam no volume `/app/data` (banco + uploads).

```bash
cp .env.example .env
```

Edite o `.env` (no mínimo `SITE_URL` e `APP_SECRET`) e suba:

```bash
docker compose up -d --build
```

```bash
docker compose exec nos npm run user:create -- --name "Pedro Henrique" --email pedro@seudominio.com.br
```

Coloque um proxy com HTTPS na frente (Caddy, Traefik ou Nginx com Let's Encrypt) apontando para a porta 3000.
Serviços como Railway, Render ou Fly.io também funcionam, desde que tenham **disco persistente** montado em
`/app/data`.

**Sem Docker**, no próprio servidor: `npm ci`, `npm run build` e `npm run start:prod` (com um gerenciador de
processos, como systemd ou pm2).

**Vercel e similares (sem disco):** o banco pode ir para o Turso (`DATABASE_URL=libsql://…`), mas os **arquivos
enviados precisam de disco persistente** e ainda não há adaptador para armazenamento em nuvem (S3/R2). Enquanto ele
não existir, prefira as opções acima. O ponto de extensão está em `src/server/media/storage.ts`.

### Depois de publicar

1. Criar as contas de Pedro e Laura e trocar as senhas temporárias.
2. Em **Painel → Editar site**: preencher WhatsApp e e-mail, enviar as fotos dos fundadores, revisar os textos.
3. Revisar a Política de Privacidade com assessoria jurídica.
4. Preencher e publicar as respostas da FAQ (as do seed são rascunhos).
5. Configurar o SMTP para receber o aviso de novos leads e a recuperação de senha.
6. Agendar o backup (abaixo) e guardar cópias fora do servidor.

## Backup e restauração

```bash
npm run backup
```

Gera `data/backups/nos-backup-AAAAMMDD-HHMMSS.tar.gz` com uma cópia íntegra do banco e todos os uploads, mantendo os
14 mais recentes (`-- --keep 30` muda a retenção; `-- --out /outro/disco` muda o destino). Agende no servidor, por
exemplo todo dia às 3h:

```bash
0 3 * * * cd /caminho/do/projeto && npm run backup >> data/backups/backup.log 2>&1
```

Para restaurar, **pare o site** e rode:

```bash
npm run restore -- data/backups/nos-backup-AAAAMMDD-HHMMSS.tar.gz
```

O banco e os uploads atuais não são apagados: ficam ao lado com o sufixo `.antes-da-restauracao-…`. O ciclo
backup → restauração foi testado (integridade do banco conferida). Em **Painel → Configurações → Dados** também é
possível exportar tudo em JSON/CSV a qualquer momento — os dados pertencem à NÓS.

## Segurança e LGPD

- Login individual, senhas com Argon2id, sessões em cookie `httpOnly` (o banco guarda só o hash do token), limite de
  tentativas, recuperação de senha por link de uso único, trilha de auditoria.
- Toda página e ação do painel confere a sessão no servidor; o painel não é indexado.
- Formulário público com validação, campo-isca, tempo mínimo e limite por IP; o consentimento é gravado com data e
  versão da política. O site não usa cookies de rastreamento.
- Uploads validados pelo conteúdo, imagens reprocessadas sem metadados (EXIF/GPS), arquivos privados (contratos,
  comprovantes) servidos só com sessão.
- Cabeçalhos de segurança (CSP, HSTS, nosniff) em `next.config.ts`.

## Como o site fica rápido e editável

As páginas públicas são estáticas e leem o conteúdo por funções com cache (`src/server/site/queries.ts`). Quando
alguém salva algo no painel, o cache é invalidado na hora (`invalidateSite()`), e a próxima visita já vê a versão
nova. Na inicialização, `scripts/start.sh` chama `/api/health`, que renova o cache — assim o site sempre reflete o
banco real, mesmo quando o build roda sem acesso a ele.

## O que depende dos sócios

- Número de WhatsApp, e-mail comercial e domínio.
- Fotos reais de Pedro e Laura (individuais e do casal). Até lá, o site usa composições gráficas da marca.
- Quantidades, limites e valores dos pacotes (hoje "Sob consulta", como combinado).
- Respostas da FAQ sobre pagamento, prazo, alterações, cancelamento e atendimento fora da cidade.
- Revisão jurídica da Política de Privacidade e dos modelos de contrato.
- Projetos e depoimentos autorizados, para ligar o portfólio.

## Estrutura

```
src/app/(site)/        páginas públicas          src/components/site/   design system do site
src/app/(auth)/        login e senha             src/components/ui/     kit do painel (README próprio)
src/app/painel/        um diretório por módulo   src/components/brand/  logo vetorial
src/server/            regras e consultas        src/lib/               domínio, formatação, auth, propostas
src/db/schema.ts       banco de dados            drizzle/               migrations
scripts/               migrate, seed, usuários, backup, restore, start
docs/briefing/         briefing dos sócios e briefing técnico
```

Convenções para quem for desenvolver (inclusive assistentes de código): [`CLAUDE.md`](CLAUDE.md).
