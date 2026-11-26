# NÓS Studio — site institucional + painel de gestão

Site público e área administrativa da **NÓS Studio** (marketing, conteúdo e audiovisual), dos sócios Pedro Henrique e
Laura Nepomuceno. *Sua história, nosso olhar.*

O projeto tem dois ambientes no mesmo aplicativo:

- **Site público** — apresenta a marca, capta pedidos de orçamento e pode ser editado pelos sócios sem programar.
- **Painel privado** (`/painel`) — leads, clientes, orçamentos em PDF, agenda, projetos, financeiro, contratos,
  calendário de conteúdo, biblioteca da marca e o editor do próprio site.

Os requisitos estão em [`docs/briefing/`](docs/briefing): o briefing dos sócios e o técnico (primeira entrega) e o
**briefing v2** (`briefing-v2.pdf` / `briefing-v2.txt`), que pede a evolução para uma plataforma em quatro
ambientes — site, Painel Administrativo, Área da Equipe e Área do Cliente. O v2 está sendo implementado por etapas:
o que já vale está em "O que está pronto"; o que falta, em "Próximas etapas do briefing v2".

Para os sócios: [`docs/manual-do-painel.md`](docs/manual-do-painel.md) (manual de uso, também disponível no painel em **Ajuda**) e
[`docs/contas-e-servicos.md`](docs/contas-e-servicos.md) (domínio, hospedagem, e-mail, backups, contas e suporte pós-entrega).

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
| Visão geral | `/painel` | Leads novos, orçamentos aguardando, entregas, pagamentos, compromissos da semana — cada cartão só para quem pode ver o módulo |
| Leads | `/painel/leads` | Pedidos vindos do site (origem, data, consentimento); converter em cliente |
| Clientes | `/painel/clientes` | Cadastro, funil em quadro (o cliente avança sozinho ao enviar/aceitar proposta e criar projeto), histórico, vínculos, CSV, dados do titular (LGPD) |
| Orçamentos | `/painel/orcamentos` | Itens, cálculo interno de custos e margem, sinal e parcelas, modelos, versões, **PDF**, parcelas → financeiro |
| Agenda | `/painel/agenda` | Visões dia, semana, mês, ano e lista; categorias e agendas (geral, pessoais, produções…); repetição; compromisso particular ("Ocupado" para os outros); aviso de conflito de horário; planejamento de gravação; camadas de prazos, editorial e financeiro |
| Tarefas | `/painel/tarefas` | Lista de tarefas com prazo, prioridade e responsável |
| Projetos | `/painel/projetos` | Etapas, checklist, links de arquivos e entregas, situação do backup |
| Financeiro | `/painel/financeiro` | Previsto × realizado, contas a receber/pagar, reserva de caixa, CSV |
| Contratos | `/painel/contratos` | Modelos com campos automáticos (`{{cliente}}`, `{{valor_total}}`…), documentos, arquivo assinado (privado) |
| Conteúdo | `/painel/conteudo` | Calendário editorial: ideia → roteiro → gravação → edição → aprovação → publicado |
| Marca | `/painel/marca` | Logos, paleta, fontes e links dos materiais |
| Editar site | `/painel/site` | Textos, fotos, avisos, serviços, pacotes, FAQ, portfólio, depoimentos, visibilidade, SEO |
| Configurações | `/painel/config` | Usuários (perfis, convites e permissões por pessoa), notificações, padrões de proposta, exportação de dados, auditoria |

> **Regra de segurança do PDF:** custos internos, margem, notas internas e descontos não aprovados nunca saem do
> painel. O PDF é montado só a partir de uma "visão pública" da proposta (`src/lib/proposals/public.ts`), coberta por
> testes que falham se qualquer valor interno escapar. Os campos automáticos dos contratos usam a mesma visão.

**Do briefing v2, já valendo**

- **Perfis e permissões** — seis perfis (administrador, sócio, gestor, funcionário, freelancer, cliente) mais o
  acesso técnico; matriz de permissões por módulo e ação, ajustes por pessoa, escopo por projeto e por cliente, tudo
  conferido no servidor. Gestor e funcionário já usam o painel restrito (menu, visão geral e páginas só com o que
  podem ver). Referência: [`docs/permissoes.md`](docs/permissoes.md).
- **Convites** — não existe cadastro público: gestor, funcionário, freelancer e cliente nascem por convite (link de
  uso único, 7 dias), com os vínculos de projeto e de cliente já definidos.
- **Tema escuro** — painel e telas de acesso em preto, grafite, roxo e lima.
- **Agenda nova** — a da tabela acima. Fora da tela da Agenda (visão geral, ficha do cliente, projeto, exportações,
  anexos) vale a mesma regra de privacidade: compromisso particular de outra pessoa é só "Ocupado", ou não aparece.
  **Os lembretes ainda só ficam registrados no compromisso; o envio (aviso no painel e e-mail) é a próxima etapa.**

**Próximas etapas do briefing v2** — Área da Equipe (`/equipe`) e Área do Cliente (`/cliente`), que hoje não
existem (freelancer e cliente têm conta, mas o login avisa que o acesso ainda não foi liberado); envio dos lembretes
da agenda; agenda, conteúdo, marca e arquivos "só nos projetos da pessoa" para o funcionário. Detalhes e pendências
em `docs/permissoes.md`, seção 10.

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
Para o desenvolvedor, use `--role tecnico` (conta temporária: usa o painel, mas não gerencia contas, não vê
Notificações nem Auditoria e não exporta dados) e, ao final, revogue com
`npm run user:create -- --email dev@dominio.com.br --deactivate`. Para gerar nova senha: `--reset`.

**Login travado ("Muitas tentativas de entrar nesta conta")?** Depois de 40 tentativas erradas em 1 hora para o
mesmo e-mail, a conta passa 1 hora em modo restrito (3 tentativas por IP; quem sabe a senha continua entrando, e um
navegador que já entrou na conta nem é afetado). Para destravar na hora, sem mudar a senha:

```bash
npm run user:create -- --email pedro@seudominio.com.br --unlock
```

Também destravam: concluir "Esqueci minha senha", **Usuários → Nova senha** e `--reset`. Trocar a senha, gerar
senha nova, mudar o e-mail ou desativar a conta invalida os links de redefinição pendentes.

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
| `TRUSTED_PROXIES` | Quantos proxies ficam na frente do app: só Nginx, Caddy ou Traefik = 1; Cloudflare + Nginx = 2 | `1` |

**Sem SMTP** o sistema funciona, mas nenhum e-mail sai (aviso de novo lead, link de "Esqueci minha senha"). Em
produção o log do servidor recebe só uma linha por e-mail não enviado — destinatário mascarado e assunto, sem o
texto, sem o link e sem os dados do lead. (Em desenvolvimento o texto completo vai para o log, para testar os
fluxos.) Para redefinir uma senha sem SMTP: **Painel → Configurações → Usuários → Nova senha** ou
`npm run user:create -- --email … --reset`.

**`TRUSTED_PROXIES` precisa estar certo.** O IP do visitante (limite de tentativas de login e do formulário,
auditoria) é lido do cabeçalho `X-Forwarded-For`, contando esse número de proxies a partir do fim. Com o número
menor que o real, todos os visitantes dividem o mesmo IP (o do proxy) e um só abusador trava o login e o formulário
para todo mundo; com o número maior, o visitante consegue forjar o próprio IP.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start:prod` | Build e inicialização de produção (migra o banco e renova o cache do site) |
| `npm run db:setup` | Migrations + conteúdo inicial |
| `npm run db:generate` | Gera uma migration depois de alterar `src/db/schema.ts` |
| `npm run user:create` | Cria contas, gera senha (`--reset`), desativa (`--deactivate`) e destrava o login (`--unlock`) |
| `npm run backup` / `npm run restore` | Backup e restauração (banco + uploads) |
| `npm run typecheck` · `npm run lint` · `npm run test` | Verificações. Cada execução dos testes cria o próprio banco numa pasta temporária (apagada no fim): dá para rodar duas ao mesmo tempo, e nada fica em `data/` |

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

**O app nunca fica exposto direto na internet.** O `docker-compose.yml` publica a porta só em `127.0.0.1:3000`;
coloque um proxy com HTTPS na frente (Caddy, Traefik ou Nginx com Let's Encrypt), no mesmo servidor, apontando para
`http://127.0.0.1:3000`. Não troque por `"3000:3000"`: o Docker abre a porta para fora mesmo com firewall no
servidor e, sem o proxy, qualquer pessoa forja o `X-Forwarded-For` e burla os limites de tentativas. (Proxy em
contêiner no mesmo compose? Remova o bloco `ports` e aponte para `http://nos:3000`.)

O proxy precisa **sobrescrever** os cabeçalhos de encaminhamento, não repassar os que o visitante mandou. Nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 32m;   # uploads do painel
}
```

Caddy (`reverse_proxy 127.0.0.1:3000`) e Traefik já fazem isso por padrão. Com **Cloudflare na frente do Nginx**,
use no Nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` e `TRUSTED_PROXIES=2` no `.env` (e
aceite conexões só dos IPs da Cloudflare). Confira depois de publicar: entre no painel e veja em **Minha conta →
Sessões ativas** se o IP mostrado é o seu, e não o do proxy.

Serviços como Railway, Render ou Fly.io também funcionam, desde que tenham **disco persistente** montado em
`/app/data`. Nessas plataformas, confira quantos proxies ficam na frente do app antes de definir
`TRUSTED_PROXIES` (o teste das **Sessões ativas** acima mostra se o número está certo).

**Sem Docker**, no próprio servidor: `npm ci`, `npm run build` e `npm run start:prod` (com um gerenciador de
processos, como systemd ou pm2). Vale a mesma regra: inicie com `BIND_HOST=127.0.0.1 npm run start:prod` (variável
do ambiente do processo, não do `.env`: o app passa a aceitar só conexões do proxy no mesmo servidor) ou feche a
porta 3000 no firewall, e faça o proxy sobrescrever os cabeçalhos.

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
7. Conferir o proxy: a porta 3000 não responde de fora do servidor e o IP em **Minha conta → Sessões ativas** é o
   do visitante (ver `TRUSTED_PROXIES`).

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

Os backups guardam dados pessoais: um cliente ou uma foto excluídos no painel continuam nas cópias antigas até elas
saírem da retenção (14 por padrão). Leve isso em conta ao responder a um pedido de eliminação (LGPD).

## Segurança e LGPD

- Login individual, senhas com Argon2id, sessões em cookie `httpOnly` (o banco guarda só o hash do token; no máximo
  10 por conta), recuperação de senha por link de uso único (invalidado quando a senha muda por outro caminho, com
  resposta no mesmo tempo exista ou não a conta), trilha de auditoria.
- Limite de tentativas de login por IP, por e-mail + IP e por e-mail (`src/lib/auth/login-limits.ts`). A barreira por
  e-mail não tranca o dono: liga um "modo restrito" de 1 hora (3 tentativas por IP) e isenta navegadores que já
  entraram na conta. IPv6 é agrupado por /64 e um `X-Forwarded-For` inválido cai num balde único.
- Toda página e ação do painel confere a sessão **e a permissão** no servidor (perfil, ajustes da pessoa e, para o
  funcionário, o projeto); o painel e as telas de login não são indexados. Matriz, guardas e testes de isolamento:
  [`docs/permissoes.md`](docs/permissoes.md).
- Agenda: compromisso **particular** só é lido por quem participa dele — nem administrador vê mais do que "Ocupado".
  Vale também na visão geral, na ficha do cliente, no projeto, nos anexos e nas exportações (na completa, sai
  mascarado; em "Dados deste titular", fica de fora com aviso). A cópia integral é o backup do servidor.
- Perfil **técnico** (temporário): usa o painel, mas não gerencia contas, não vê Notificações nem Auditoria e não
  exporta dados (as rotas de exportação respondem 403).
- Formulário público com validação, campo-isca e limite por IP; envio rápido demais não é descartado, é gravado e
  sinalizado na ficha do lead. O consentimento é gravado com data e versão da política. O site não usa cookies de
  rastreamento.
- Uploads validados pelo conteúdo, imagens reprocessadas sem metadados (EXIF/GPS), arquivos privados (contratos,
  comprovantes) servidos só com sessão. Imagens públicas só são entregues a visitantes enquanto algum conteúdo
  **publicado** as usa (despublicar tira a foto do ar; cache de 24 h) e o arquivo é apagado quando o registro que o
  usava é excluído ou troca de imagem. Um upload abandonado sem salvar fica guardado (visível só com sessão): não há
  varredura automática de órfãos.
- LGPD: exportação "Dados deste titular" (JSON) na ficha do cliente e exclusão de cliente com contagem do que
  permanece e opção de apagar os pedidos do site da mesma pessoa.
- Avisos agendados da barra do topo não saem no HTML antes da hora.
- Cabeçalhos de segurança (CSP, HSTS, nosniff, COOP) em `next.config.ts`.

**Pendência conhecida — CSP com nonce.** A política atual permite script inline (`script-src 'self'
'unsafe-inline'`), porque as páginas públicas são estáticas e o Next injeta scripts inline na hidratação. Ela barra
scripts de outros domínios, frames e envios de formulário para fora, mas não barraria um `<script>` injetado caso
surgisse uma falha de injeção de HTML no painel (hoje não há nenhuma conhecida: nada do banco é renderizado como
HTML). O passo seguinte é gerar um nonce por requisição em `src/proxy.ts` para `/painel/**` e para as telas de
login, com `script-src 'self' 'nonce-…' 'strict-dynamic'` nessas rotas.

**Limite conhecido — 404 do portfólio.** A primeira visita a um endereço `/portfolio/<slug>` que não existe (ou de
um projeto recém-despublicado) responde 200 com a página "não encontrada" e `noindex`; da segunda em diante, 404. É
um limite do Next 16 com Cache Components (detalhes no comentário de `src/app/(site)/portfolio/[slug]/page.tsx`).

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
docs/briefing/         briefing dos sócios, briefing técnico e briefing v2 (briefing-v2.pdf / .txt)
docs/                  manual do painel, contas e serviços, permissões (perfis, matriz, guardas, privacidade da agenda)
```

Convenções para quem for desenvolver (inclusive assistentes de código): [`CLAUDE.md`](CLAUDE.md).
