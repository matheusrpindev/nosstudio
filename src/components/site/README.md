# Design system do site público

Direção de arte aprovada: **"Suíço / Editorial"** — fundo off-white, grid rígido de 12 colunas, fios finos, seções
numeradas ("01 — Serviços"), títulos gigantes em Montserrat Black com tracking apertado, blocos de cor chapada
(roxo, lavanda, grafite), cantos retos, cantoneiras de visor emoldurando painéis e **lima só como cor-sinal**
(CTAs, etiqueta, o destaque "um nós."). Sem fotos, os espaços de imagem mostram um estado vazio intencional
(monograma gigante ou o Ó do logo num campo de cor).

- CSS: `src/app/(site)/site.css` (importado pelo layout do site). Classes com prefixo `s-`, dentro de
  `@layer components` — utilitários do Tailwind continuam funcionando por cima (`className="s-h2 mt-8"`).
- Componentes: esta pasta. Quase tudo é Server Component; os únicos clientes são `site-header`, `footer-experience-loader` (que baixa sob demanda o motor do rodapé interativo, `footer-experience-engine.ts`),
  `announcement-bar`, `lead-form`, `video-embed`, `whatsapp-float` e `reveal-observer`.
- Moldura: `site-shell.tsx` (usada pelo layout e pelo 404) — barra de avisos, cabeçalho, rodapé e WhatsApp
  flutuante. O `<Logo>` entra nos componentes cliente como `children`/prop, nunca por import.
- A home (`src/app/(site)/page.tsx`) é o exemplo completo de uso.

## Página nova em 1 minuto

```tsx
// src/app/(site)/servicos/page.tsx
import { CtaBand } from "@/components/site/blocks";
import { PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { SiteButtonLink } from "@/components/site/button";
import { sectionCounter } from "@/components/site/text";
import { buildMetadata } from "@/lib/site/seo";
import { getServices, getSiteContent } from "@/server/site/queries";

export const generateMetadata = () => buildMetadata("servicos");

export default async function ServicosPage() {
  const [content, services] = await Promise.all([getSiteContent(), getServices()]);
  const page = content.servicesPage;
  const next = sectionCounter(); // "01", "02"… só avança para seções que renderizam

  return (
    <>
      <PageHeader
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.intro}
        actions={<SiteButtonLink href={page.cta.href}>{page.cta.label}</SiteButtonLink>}
      />
      {services.length > 0 ? (
        <Section id="lista" number={next()} label={page.eyebrow} labelledBy="lista-titulo">
          <SectionHeader id="lista-titulo" title="…" lead="…" />
          {/* conteúdo */}
        </Section>
      ) : null}
      <CtaBand title={page.closingTitle} text={page.closingText} cta={page.cta} />
    </>
  );
}
```

O layout já entrega barra de avisos, cabeçalho, `<main id="conteudo">`, rodapé e WhatsApp flutuante. A página
só devolve o conteúdo: **um `<PageHeader>` (o único `<h1>`)**, uma sequência de `<Section>` e, no fim, um
`<CtaBand>` ou um formulário.

## Regras de dados (as páginas ficam ESTÁTICAS)

- Leia dados **só** pelas funções de `src/server/site/queries.ts` (`getSiteContent`, `getHomeLayout`, `getSiteImages`,
  `getServices`, `getServiceBySlug`, `getPackages`, `getFaqs`, `getPortfolio`, `getTestimonials`, `getSiteNav`,
  `getLeadOriginNames`). Todas são `"use cache"` com a tag `site`; o painel atualiza com `invalidateSite()`.
- Caminhos das páginas: `SITE_PATHS` / `servicePath(slug)` em `src/lib/site/paths.ts` (não escreva `/planos` à mão).
- Página inicial: a ordem e a visibilidade das seções vêm de `getHomeLayout()` (painel › Editar site › Página
  inicial). Seção nova = um id em `src/lib/site/home-layout.ts` + um bloco em `src/app/(site)/page.tsx`.
- Nada de `cookies()`, `headers()`, `searchParams`, `new Date()`, `Math.random()` nem acesso direto ao banco no
  caminho de renderização. Precisa de algo da URL? Leia no navegador (o `<LeadForm>` já faz isso para
  `?servico=` e `?pacote=`). Precisa de data atual? Função `"use cache"` (veja `currentYear` em `site-shell.tsx`).
- Em rota dinâmica (`/portfolio/[slug]`, `/servicos/[slug]`), exporte `generateStaticParams` para a página continuar
  pré-renderizada.
- **Toda copy vem de `getSiteContent()`** (modelo em `src/lib/site/content.ts`). No JSX só ficam rótulos de
  interface ("Abrir menu", "Investimento", "(opcional)").
- **Bloco sem conteúdo publicado não renderiza** — nem título, nem link. Padrão:
  `{items.length > 0 ? <Section number={next()} …> … </Section> : null}`. Respeite `content.visibility`.
- Links vindos do painel: use `SiteButtonLink` / `SiteLink` / `SmartLink` (passam por `safeHref`; link inválido
  não renderiza). WhatsApp: `whatsAppLink(general.whatsapp, general.whatsappMessage)` — vazio = não mostra o botão.

## Estrutura e tipografia — `layout.tsx`

| Componente | Para quê |
| --- | --- |
| `<Container>` | Largura máxima + margens laterais (`.s-wrap`). A `<Section>` já tem um dentro. |
| `<Grid>` | 12 colunas a partir de 1024px. Filhos com `lg:col-span-4`, `lg:col-start-5`, `lg:col-[5/-1]`. |
| `<Section number label tone spaceTop bleed>` | Seção com o fio e a numeração. `tone="roxo" \| "grafite" \| "lavanda"` vira bloco de cor chapada. `bleed` recebe conteúdo de largura total (ex.: `<StatementBanner spaceTop />`); a seção seguinte, se for no papel, usa `spaceTop="lg"`. |
| `<SectionHeader title lead id>` | Título grande (`h2`) à esquerda + texto de apoio à direita. |
| `<PageHeader eyebrow title lead text actions meta sentences>` | Abertura das páginas internas, com o `<h1>`. `sentences`: título de duas frases, cada uma na sua linha. |
| `<Display as size accent>` | Título gigante. `size="d0"` para fechamentos. `accent="tail"` destaca as duas últimas palavras; `accent="marked"` só o trecho marcado. |
| `<Heading as size>` | `size="h2" \| "h3" \| "h4"` (desenho) independente de `as` (semântica). |
| `<Accented text>` | O "sinal" lima num trecho do título. |

**Destaque em títulos.** Os sócios podem marcar o trecho no próprio texto, entre asteriscos:
`Antes de existir a NÓS, já existia *um nós.*` No papel/lavanda vira a barra lima atrás do texto; em roxo/grafite,
texto lima. (Lima nunca é texto sobre fundo claro.)

Classes utilitárias de texto: `s-meta` (rótulo 13px), `s-lead` (texto de apoio), `s-muted` (cor secundária),
`s-h2`, `s-h3`, `s-h4`, `s-d1`, `s-d0`, `s-prose` (texto longo: `<Markdown className="s-prose">`).

**Tons.** `data-tone` em qualquer bloco (ou a prop `tone`) troca fundo, texto, fios e cor de foco de uma vez — e
botões/links dentro dele se adaptam sozinhos. Use os tokens do tema (`var(--color-roxo)`, `--color-lima`,
`--color-lavanda`, `--color-offwhite`, `--color-grafite`); não crie cores novas.

**Breakpoints** (iguais aos do Tailwind): 640 · 768 · 1024 · 1280. Mobile-first: escreva o celular primeiro.

## Botões e links — `button.tsx`

```tsx
<SiteButtonLink href={cta.href}>{cta.label}</SiteButtonLink>                    // primário (lima)
<SiteButtonLink href="/servicos" variant="secondary">Ver serviços</SiteButtonLink> // contorno
<SiteButtonLink href={whatsapp} icon="whatsapp">…</SiteButtonLink>              // externo abre em nova aba
<SiteButton type="submit">Enviar</SiteButton>                                    // <button>
<SiteLink href={cta.href}>{cta.label}</SiteLink>                                 // link sublinhado com seta
```

`icon`: `"arrow"` (padrão) · `"arrow-ne"` · `"arrow-down"` · `"whatsapp"` · `"instagram"` · `"mail"` · `null`.
`size="sm"`, `block` (largura total). Altura mínima de 56px (44px no `sm`).

## Marcas gráficas — `marks.tsx`

`<Icon name>` · `<AccentMark>` (o acento do Ó) · `<PlayMark>` · `<RingsMark>` (dois anéis entrelaçados: o "nó")
· `<LevelMark level total>` · `<ViewfinderFrame>` (cantoneiras; o pai precisa ser `relative` — classe `s-framed`)
· `<RecDot>` · `<RatioFrame kind="play" | "accent" | "rings">` (enquadramentos 16:9, 9:16 e 4:5).
Tudo decorativo (`aria-hidden`) e na cor `currentColor`.

## Imagens — `photo-slot.tsx`, `site-image.tsx`

```tsx
<PhotoSlot
  image={images.founders[0]}          // PublicImage | null
  tone="roxo"                         // cor do campo no estado vazio (alterne roxo / lavanda / grafite)
  monogram={founder.name}             // estado vazio: "P" gigante. Sem monogram: o Ó do logo
  ratio="4 / 5"                       // "3 / 4" | "1 / 1" | "3 / 2" | "16 / 9" | "16 / 10" | "9 / 16"
  index="01"
  alt={`Retrato de ${founder.name}`}
  sizes="(min-width: 1024px) 33vw, 50vw"
  caption={<><strong>{founder.name}</strong><span>{displayRole(founder.role)}</span></>}
/>
```

Com foto, a imagem entra com `srcset`, `width`/`height` e a cor dominante de fundo; sem foto, o estado vazio
ocupa exatamente o mesmo espaço. `<SiteImage image sizes priority>` é o `<img>` puro (use `priority` só na imagem
do topo da página). `<VideoEmbed url title poster>`: YouTube sem cookies/Vimeo, o iframe só carrega ao clicar;
link que não for de YouTube/Vimeo não renderiza nada.

## Blocos prontos — `blocks.tsx`, `package-card.tsx`, `showcase.tsx`, `home-hero.tsx`

| Componente | Uso |
| --- | --- |
| `<ServicePanels items looks>` | Painéis de cor contíguos com enquadramento por proporção. `items: { title, text, href }[]`; `looks` troca cor/motivo de cada painel. |
| `<ValuesList items>` | Valores em colunas, com o acento do logo. |
| `<Steps items action stairs>` | Passos numerados; no desktop viram "escada" (3 a 8 passos). `stairs={false}` = grade simples. Sem texto nos passos, os nomes crescem. |
| `<StatementBanner text>` | Frase de impacto em largura total. Duas frases → duas metades (lavanda + roxo) com o play na emenda. |
| `<FaqAccordion items name>` | `<details>` nativo (funciona sem JS), uma resposta aberta por vez; respostas em markdown leve. Passe só perguntas publicadas (`getFaqs()` já filtra). |
| `<ContactChannels channels>` | Linhas de WhatsApp/Instagram/e-mail. Canal com `href` vazio some sozinho. |
| `<CtaBand title text cta secondaryCta tone>` | Faixa de fechamento das páginas internas. |
| `<PackageBoard packages recommendedLabel priceOnRequestLabel detail>` | Planos. `detail="full"` (em /planos) mostra inclusos ("Tudo do plano-base, mais:"), captação, revisões e opcionais. Valor sempre conforme `priceMode`: sem valor publicado entra `priceOnRequestLabel`; quantidades só quando preenchidas. |
| `<PlanComparison plans caption>` | Tabela comparativa montada do "Inclui" de cada plano (`src/lib/site/plans.ts`). Rola na horizontal no celular. |
| `<ServiceIndex services>` | Índice tipográfico dos serviços (home, "outros serviços"): a linha inteira leva a `/servicos/<slug>`. |
| `<DifferentialsList items>` | Grade numerada (diferenciais, benefícios de um serviço). O texto de cada item é opcional. |
| `<StandaloneIndex packages>` | Serviços avulsos em linhas curtas (home); cada uma leva ao formulário com o serviço escolhido. |
| `<LegalPage>` | Páginas legais (privacidade, termos, cookies): markdown com índice lateral. |
| `<PackagePrice pkg>` | Só o preço formatado ("Sob consulta", "A partir de R$ …"). |
| `<PortfolioGrid projects>` / `<PortfolioCard>` | Cartões de projeto (capa ou estado vazio). O miolo é `<PortfolioCardBody>` (`portfolio-card.tsx`), que já põe o selo "Experiência anterior" quando `origin = experiencia_anterior`. |
| `<PortfolioBrowser projects labels>` | Grade de `/portfolio` com pesquisa e filtros (ver "Portfólio" abaixo). |
| `<PortfolioProjectGallery images label variant>` | Miniaturas que abrem a ampliação (`<PortfolioLightbox>`). `variant="backstage"` = grade densa dos bastidores. |
| `<PortfolioBeforeAfter before after caption beforeLabel afterLabel>` | Comparação "antes e depois" com divisória arrastável. |
| `<PortfolioShare title url>` | Copiar link + Web Share API (ou WhatsApp, onde ela não existe). Sem script de terceiros. |
| `<PortfolioProjectJsonLd project>` | Dados estruturados da página de um projeto (`CreativeWork` + trilha). |
| `<TestimonialGrid testimonials>` / `<TestimonialCard>` | Depoimento em texto, print (com descrição acessível) ou vídeo. |
| `<HomeHero>` | O hero da home (título cruzando o campo de cor). É o topo da página quando NÃO há banner no ar. |
| `<HomeBanners banners title eyebrow>` | O carrossel de banners da home (ver "Banners" abaixo). |

### Banners (carrossel da home) — `banner-*.tsx`, `banner.css`

Dados: `getBanners()` (só os ligados, dentro da janela e com o mínimo para aparecer; agendado não sai do servidor
antes da hora). Lista vazia → a página usa `<HomeHero>`. Regras puras e tipos em `src/lib/site/banners.ts`.

| Arquivo | Papel |
| --- | --- |
| `banner-section.tsx` | `<HomeBanners>` (Server): monta um `<BannerSlide>` por banner, com o Ó do logo, e entrega ao carrossel. Dono do `<h1>` da página (o título de abertura, só para leitores de tela e buscadores). |
| `banner-slide.tsx` | `<BannerSlide banner eyebrow symbol priority viewport titleAs>`: UM banner, nas três montagens (`tipografico`, `midia`, `peca`). Sem dependência de servidor: é o mesmo componente na prévia do painel. `<BannerStill>` = o contêiner de medidas para um banner fora do carrossel. |
| `banner-carousel.tsx` | `<BannerCarousel slides heading timeZone>` (Client): padrão "carousel" do WAI-ARIA APG — pausa (primeiro controle), setas, indicadores, teclado (← → Home End), arrastar no celular, duração por banner, `aria-live` desligado enquanto roda sozinho, nada automático com `prefers-reduced-motion`. Um banner só = sem controles. |
| `banner-media.tsx` | `<BannerMedia>` (Client): `<picture>` com a versão de celular e de computador; vídeo de fundo só no banner em tela, e nunca com movimento reduzido ou `Save-Data`. |
| `banner-title.ts` | Quebra do título em duas linhas e métricas para o corpo caber. |
| `banner.css` | Estilos. **Consultas de contêiner** (`@container banners`, unidades `cqi`): o banner se monta pela largura do bloco em que está — 4:5 abaixo de 640px, 12:5 acima. Depende dos tokens de `site.css` (precisa de um ancestral `.site`). |

- Cor de fundo → composição (`COMPOSITIONS` em `banner-slide.tsx`): roxo = visor + Ó; grafite/preto = play; lima =
  acento; lavanda = anéis; off-white/branco = papel com campo roxo. Cor nova na paleta precisa entrar ali.
- Os botões levam `data-track="banner:<id>"` (coletor de cliques) e o endereço já vem resolvido por
  `resolveBannerHref` (página fora do ar → destino alternativo).
- A troca de banner é por opacidade, com todos empilhados na mesma célula de grade: a altura é a do maior e não
  há salto de layout. Banner fora de tela fica `inert`.

O botão de cada plano aponta para `/contato?servico=…&pacote=…#formulario` (`packageContactHref`); a página de cada
serviço tem o próprio formulário (`#servico-orcamento`, já com o serviço e a origem preenchidos). **A página de
contato deve colocar `id="formulario"` no `<LeadForm>`.** `?pacote=` só vale para nomes publicados
(`getLeadOriginNames()`).

## Portfólio — `portfolio-*.tsx` + `src/lib/site/portfolio.ts`

- **Dados**: `getPortfolio()` devolve só projetos publicados, na ordem do painel, já no formato público
  (`PublicPortfolioProject`). Quem monta esse formato é `toPublicProject` (`src/lib/site/portfolio.ts`, testado): nome
  de cliente sem autorização nunca sai, bloco vazio sai vazio e par de antes/depois só com as duas imagens. Não leia
  `portfolio_projects` por outro caminho.
- **Grade com pesquisa e filtros** (`/portfolio`): `<PortfolioBrowser>` (servidor) renderiza TODOS os cartões e
  entrega a `<PortfolioFilter>` (cliente) só id, categoria e o texto pesquisável de cada um. O filtro esconde com
  `hidden`; nada é buscado no servidor e a página continua estática. O estado vai na URL (`?categoria=&q=`), lido com
  `useSyncExternalStore` — **não use `useSearchParams` aqui**: ele tiraria a grade do HTML pré-renderizado.
  Links para um filtro pronto funcionam de qualquer página: `/portfolio?categoria=casamentos`.
- **Destaque**: `data-featured` no cartão (duas colunas, mesma altura das capas vizinhas — a conta usa `cqw` em
  `portfolio.css`). A home usa `homeFeaturedProjects()`; relacionados, `relatedProjects()`.
- **Ampliação**: `<PortfolioLightbox>` é um `<dialog>` modal nativo (foco preso, Esc, resto da página inerte).
  Teclado: ← → Home End; toque/mouse: arrastar para os lados. Todo fechamento passa por `dialog.close()`.
- **Antes e depois**: há um `<input type="range">` de verdade por baixo (teclado e leitores de tela); mouse e toque
  arrastam o quadro inteiro. A posição vai na variável CSS `--pos`.
- **Vídeos**: sempre `<VideoEmbed>` (o iframe só existe depois do clique; YouTube sem cookies, Vimeo com `dnt=1`).
- CSS: `src/app/(site)/portfolio/portfolio.css` (importado pelas duas páginas) e `portfolio-card.css` (selos do cartão,
  importado pelo próprio componente porque o cartão aparece também na home e nas páginas de serviço).

## Formulário de contato — `lead-form.tsx`

```tsx
<LeadForm
  id="formulario"
  variant="full"                               // "compact" (home) | "full" (contato, página de serviço) | "event" (Eventos e Casamentos)
  originPath="/contato"
  consentText={content.contactPage.consentText}
  submitLabel={content.contactPage.submitLabel}
  title="…" text="…"                           // opcionais, dentro do cartão
  defaultInterest="casamentos"                 // opcional (ServiceInterest)
  defaultEventType="Casamento"                 // só na variante "event"
  bordered                                     // contorno fino quando o formulário está sobre o papel
/>
```

A variante "full" é o formulário "inteligente": além de nome, empresa, WhatsApp, e-mail, serviço, objetivo e
observações, mostra os campos do TIPO do serviço escolhido (marketing → segmento e perfil; audiovisual → tipo e
previsão; evento → data e local) — a regra está em `leadFieldGroup` (`src/lib/domain.ts`) e o servidor só grava os
campos do tipo (`buildLeadRecord`). A variante "event" tem tipo, data, horário, cidade, local, convidados e
serviços; o tipo de evento decide o interesse gravado. O envio vira lead; nunca cria compromisso na agenda.

Já resolve: Server Action (`submitLeadAction`), erros por campo com `aria-describedby`, foco no primeiro campo
inválido, máscara de telefone, campo-isca e tempo mínimo (anti-spam), estado de envio e tela de sucesso com foco
no título e botão "Continuar no WhatsApp" quando houver número configurado. Lê `?servico=` e `?pacote=` da URL no
navegador. Sobre um bloco roxo/grafite ele já vem como cartão claro; não precisa de invólucro.

## Movimento — `reveal.tsx`

```tsx
<Reveal delay={1}>…</Reveal>          // ou, em qualquer elemento:  <li {...revealProps(2)}>
```

O conteúdo nasce visível; o `RevealObserver` (montado pelo shell) só anima o que ainda está abaixo da dobra. Sem
JS ou com `prefers-reduced-motion`, nada muda. `delay` é a posição na sequência (× 80ms). Não use bibliotecas de
animação; hover e transições ficam no CSS.

## Medição de visitas — `visit-tracker.tsx`, `visit-counter.tsx`

O `<SiteShell>` monta o `<VisitTracker />` (coletor, não renderiza nada): a cada página vista ele envia um sinal
mínimo para `POST /api/visita` — sem cookie e sem armazenamento no navegador. As páginas continuam estáticas; quem
decide o que conta é o servidor (`src/server/metrics/collect.ts` explica o método).

**Clique medido:** ponha `data-track="<tipo>:<alvo>"` no link ou botão. Tipos aceitos (`TRACK_EVENT_TYPES` em
`src/lib/domain.ts`): `whatsapp:<onde>` (`flutuante`, `rodape`, `contato`, `canais`, `formulario` — nome novo ganha
rótulo em `WHATSAPP_PLACE_LABELS`, `src/lib/metrics/report.ts`) e `banner:<id do banner>`. Um único listener no
documento cuida de todos; link de WhatsApp sem marcação cai em `whatsapp:link`. `SiteButtonLink`/`SmartLink`
repassam o atributo.

**Contador público:** `<VisitCounterBand />` (faixa acima do rodapé, já montada pelo shell) ou `<VisitCounter />`
(só frase + número + legenda, para encaixar dentro de outro bloco `data-tone="roxo" | "grafite"`). Server
Components; não renderizam nada enquanto o contador estiver desligado em Textos › Contador de visitas (padrão),
sem visitas medidas ou abaixo do mínimo. O número vem pronto no HTML (`getPublicVisitCount()`, com cache): sem
salto de layout e sem contagem animada.

## Acessibilidade e desempenho (checklist de página)

- Um `<h1>` por página (`PageHeader` ou `HomeHero`); `h2` nas seções; `h3` nos cartões. Ligue `Section labelledBy`
  ao `id` do título.
- `id`s com o nome da página na frente (`sobre-valores`, `eventos-faq`): o Next 16 mantém a página anterior
  oculta no DOM depois de uma navegação, então `id`s repetidos entre páginas podem colidir em âncoras.
- O WhatsApp flutuante se recolhe sozinho sobre `.s-hero__actions`, `.s-banner__actions`, `.s-pagehead__actions` e `.s-form` — use o
  slot `actions` do `PageHeader` e o `<LeadForm>` em vez de recriar esses blocos.
- Alvos de toque ≥ 44px; foco visível (já vem do sistema — não remova `outline`).
- Lima só como preenchimento com texto grafite, ou como texto sobre roxo/grafite.
- Imagens sempre por `PhotoSlot`/`SiteImage` (têm `width`/`height`); `alt` descritivo, ou `alt=""` se decorativa.
- Teste em 390px e 1440px: sem rolagem horizontal, console limpo.
