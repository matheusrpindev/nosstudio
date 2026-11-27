/**
 * Modelo do conteúdo editável do site público.
 *
 * Cada chave de `siteContentSchemas` é uma "seção" guardada na tabela `site_content` (JSON) e editada no
 * painel em /painel/site. `defaultSiteContent` traz a copy dos briefings dos sócios (o v2 onde ele redefine o
 * texto; o v1 onde continua valendo) — é o que o site mostra enquanto ninguém editou nada.
 *
 * Arquivo puro (sem acesso a banco): pode ser importado no servidor e no cliente.
 * Leitura no servidor: `getSiteContent()` em src/server/site/queries.ts.
 */
import "@/lib/zod-setup";
import { z } from "zod";

// ------------------------------------------------------------------ helpers
const text = (max = 400) => z.string().trim().max(max);
const longText = (max = 20_000) => z.string().trim().max(max);
const mediaId = z.number().int().positive().nullable();
const link = z.object({ label: text(80), href: text(300) });
const titled = z.object({ title: text(120), text: text(600) });

// =================================================================== GERAL
const general = z.object({
  brandName: text(80),
  /** Slogan / conceito da marca. */
  tagline: text(120),
  /** Descritor curto usado no rodapé e em metadados. */
  descriptor: text(120),
  /** WhatsApp comercial com DDD (só números ou formatado). Vazio = botões de WhatsApp ficam ocultos. */
  whatsapp: text(30),
  /** Mensagem que já vem escrita quando o visitante abre a conversa. */
  whatsappMessage: text(300),
  email: text(160),
  instagram: text(80),
  /** Outras redes (TikTok, YouTube, LinkedIn…). */
  socialLinks: z.array(link).max(8),
  /** Cidade/região de atendimento (texto livre). Vazio = não exibe. */
  serviceArea: text(160),
  /** Linha de direitos autorais do rodapé, depois de "© ano marca". */
  copyright: text(160),
});

// =============================================================== NAVEGAÇÃO
/** Rótulos do menu (cabeçalho e rodapé) e o botão de destaque. Item com rótulo vazio some do menu. */
const navigation = z.object({
  home: text(40),
  about: text(40),
  services: text(40),
  plans: text(40),
  portfolio: text(40),
  events: text(40),
  contact: text(40),
  /** Link para o login das áreas privadas. */
  clientArea: text(40),
  cta: link,
});

// ============================================================= VISIBILIDADE
/**
 * Liga/desliga PÁGINAS e recursos do site. Blocos sem conteúdo publicado somem sozinhos mesmo ligados.
 * A ordem e a visibilidade dos blocos da página inicial ficam em ./home-layout.ts (Editar site › Página inicial).
 */
const visibility = z.object({
  portfolio: z.boolean(), // página /portfolio, item do menu e bloco na home
  testimonials: z.boolean(), // depoimentos
  faq: z.boolean(),
  packages: z.boolean(), // página /planos, item do menu e blocos de planos/avulsos na home
  weddings: z.boolean(), // página /eventos-e-casamentos, item do menu e bloco na home
  whatsappFloat: z.boolean(), // botão flutuante de WhatsApp no celular
});

// ==================================================================== HOME
const home = z.object({
  hero: z.object({
    eyebrow: text(80),
    title: text(120),
    lead: text(400),
    text: text(400),
    primaryCta: link,
    secondaryCta: link,
    /** Foto ou frame do hero (opcional — sem imagem, o site usa a composição gráfica da marca). */
    mediaId,
    mediaCaption: text(120),
  }),
  /** Bloco "Serviços": a lista vem dos serviços publicados (Editar site › Serviços). */
  highlights: z.object({
    eyebrow: text(80),
    title: text(160),
    text: text(400),
    cta: link,
  }),
  founders: z.object({
    eyebrow: text(80),
    title: text(160),
    text: longText(2000),
    cta: link,
  }),
  packages: z.object({
    eyebrow: text(80),
    title: text(160),
    text: text(500),
    cta: link,
  }),
  /** Bloco "Serviços avulsos" (a lista vem dos avulsos publicados em Editar site › Planos). */
  standalone: z.object({ eyebrow: text(80), title: text(160), text: text(500), cta: link }),
  /** Bloco "Eventos e casamentos" (os dois painéis usam os títulos da página de Eventos e Casamentos). */
  events: z.object({ eyebrow: text(80), title: text(200), text: text(500), cta: link }),
  portfolio: z.object({ eyebrow: text(80), title: text(160), text: text(500), cta: link }),
  testimonials: z.object({ eyebrow: text(80), title: text(160) }),
  faq: z.object({ eyebrow: text(80), title: text(160), cta: link }),
  closing: z.object({
    title: text(200),
    text: text(300),
    question: text(120),
    cta: link,
    signature: text(160),
  }),
});

// ============================================================== QUEM SOMOS
const founder = z.object({
  name: text(80),
  role: text(120),
  /** Resumo curto (cards da home). */
  shortBio: text(500),
  /** Texto completo (página Quem Somos). Markdown leve: parágrafos, **negrito**, listas. */
  bio: longText(6000),
  mediaId,
});

const about = z.object({
  eyebrow: text(80),
  title: text(160),
  /** Abertura da página. */
  intro: longText(4000),
  /** Foto dos dois juntos. */
  coupleMediaId: mediaId,
  foundersTitle: text(160),
  founders: z.array(founder).max(4),
  why: z.object({ title: text(160), text: longText(6000) }),
  /** Trecho em destaque (manifesto). */
  manifesto: z.object({ text: longText(3000), closing: text(300) }),
  mission: z.object({ title: text(80), text: longText(1200) }),
  vision: z.object({ title: text(80), text: longText(1200) }),
  values: z.object({ eyebrow: text(80), title: text(160), items: z.array(titled).max(8) }),
  essence: z.object({ title: text(160), text: longText(4000), signature: text(240) }),
});

// ============================================================ DIFERENCIAIS
const differentials = z.object({
  eyebrow: text(80),
  title: text(160),
  items: z.array(titled).max(8),
});

// =========================================================== COMO FUNCIONA
const howItWorks = z.object({
  eyebrow: text(80),
  title: text(160),
  steps: z.array(titled).max(8),
  closing: text(200),
});

// ================================================================ SERVIÇOS
const servicesPage = z.object({
  eyebrow: text(80),
  title: text(160),
  intro: text(600),
  /** Texto do link de cada serviço da lista para a página dele. */
  detailLabel: text(60),
  closingTitle: text(200),
  closingText: text(400),
  cta: link,
  /** Títulos dos blocos da página de cada serviço (/servicos/…). Bloco sem conteúdo não aparece. */
  detail: z.object({
    deliverablesTitle: text(120),
    benefitsTitle: text(120),
    mediaTitle: text(120),
    relatedTitle: text(120),
    faqTitle: text(120),
    quoteTitle: text(160),
    quoteText: text(400),
    othersTitle: text(120),
    /** Botão para a página temática do serviço (ex.: Eventos e Casamentos), quando houver. */
    pageLinkLabel: text(60),
  }),
});

// ================================================================= PACOTES
const packagesPage = z.object({
  eyebrow: text(80),
  title: text(160),
  intro: text(600),
  recommendedLabel: text(40),
  /** Texto no lugar do valor enquanto ele não for publicado. */
  priceOnRequestLabel: text(120),
  /** Aviso sob os planos (condições definidas em proposta). */
  note: text(400),
  /** Tabela comparativa dos planos (montada a partir das entregas de cada plano). */
  comparison: z.object({ enabled: z.boolean(), title: text(160), intro: text(400) }),
  standaloneTitle: text(160),
  standaloneIntro: text(400),
  closingTitle: text(200),
  closingText: text(400),
  cta: link,
});

// ==================================================== EVENTOS E CASAMENTOS
/** Página /eventos-e-casamentos (a chave continua `weddingsPage` para preservar o que já foi salvo). */
const weddingsPage = z.object({
  eyebrow: text(80),
  /** A chamada da página (h1). */
  title: text(160),
  lead: text(400),
  /** Botão que leva ao formulário. */
  ctaLabel: text(80),
  heroMediaId: mediaId,
  /** Parte 1 — eventos corporativos e sociais. */
  events: z.object({
    eyebrow: text(80),
    title: text(160),
    text: longText(2000),
    /** Formatos de cobertura. */
    items: z.array(titled).max(12),
  }),
  /** Parte 2 — casamentos. */
  weddingsEyebrow: text(80),
  approach: z.object({ title: text(160), text: longText(3000) }),
  coverage: z.object({
    title: text(160),
    intro: text(400),
    /** O que a cobertura pode incluir. */
    items: z.array(titled).max(12),
    note: text(400),
  }),
  proposal: z.object({ title: text(160), text: longText(2000), steps: z.array(titled).max(6) }),
  /** Galeria (projetos publicados de eventos e casamentos) — só aparece com conteúdo real. */
  galleryTitle: text(160),
  form: z.object({
    title: text(160),
    text: text(400),
    submitLabel: text(80),
    /** Aviso de que o envio não reserva a data. */
    note: text(400),
  }),
});

// =============================================================== PORTFÓLIO
const portfolioPage = z.object({
  eyebrow: text(80),
  title: text(160),
  intro: text(600),
  emptyText: text(300),
  /** Grade de /portfolio: rótulo da seção, pesquisa, filtros e o estado "nada encontrado". */
  projectsLabel: text(80),
  searchLabel: text(80),
  searchPlaceholder: text(80),
  allLabel: text(40),
  featuredLabel: text(40),
  noResultsTitle: text(160),
  noResultsText: text(300),
  clearLabel: text(60),
  /** Títulos dos blocos da página de um projeto (/portfolio/[slug]). Cada bloco só aparece com conteúdo. */
  detail: z.object({
    backLabel: text(60),
    aboutTitle: text(80),
    caseTitle: text(80),
    objectiveTitle: text(80),
    challengeTitle: text(80),
    solutionTitle: text(80),
    resultsTitle: text(80),
    videoTitle: text(80),
    galleryTitle: text(80),
    beforeAfterTitle: text(80),
    beforeLabel: text(40),
    afterLabel: text(40),
    backstageTitle: text(80),
    relatedTitle: text(80),
    shareTitle: text(80),
    /** Aviso dos projetos marcados como experiência anterior dos fundadores. */
    previousTitle: text(80),
    previousText: text(400),
  }),
});

// ================================================================= CONTATO
const contactPage = z.object({
  eyebrow: text(80),
  title: text(200),
  text: text(400),
  submitLabel: text(60),
  /** Texto do consentimento (LGPD). O link para a política é inserido automaticamente ao final. */
  consentText: text(400),
  successTitle: text(160),
  successText: text(400),
  whatsappLabel: text(60),
  instagramLabel: text(60),
});

// ============================================================= PRIVACIDADE
const privacyPage = z.object({
  title: text(160),
  /** Versão/data da política (aparece na página e é gravada junto com cada consentimento). */
  version: text(20),
  /** Texto completo em markdown. `{{email}}` e `{{marca}}` são substituídos pelos dados de Geral. */
  body: longText(30_000),
});

/** Termos de uso e política de cookies: mesmo esquema da privacidade (título, versão e markdown). */
const legalPage = z.object({ title: text(160), version: text(20), body: longText(30_000) });

// ====================================================== CONTADOR DE VISITAS
/**
 * Contador público de visitas (faixa acima do rodapé). Nasce DESLIGADO; o número é o total real da medição
 * própria do site (`src/server/metrics`) — nunca um valor digitado. Regra de exibição: `src/lib/metrics/counter.ts`.
 */
const visitCounter = z.object({
  enabled: z.boolean(),
  /** Só aparece a partir deste total de visitas (só dígitos; vazio = sem mínimo). */
  minimum: text(7).regex(/^\d*$/),
  phrase: text(160),
  /** Legenda do número: diz o que ele conta. `{{inicio}}` vira o mês em que a contagem começou. Vazia = não exibe. */
  label: text(120),
});

// ================================================== RODAPÉ INTERATIVO
/**
 * Textos do rodapé interativo (briefing v2, seção 11): a câmera e o celular simulados logo acima do rodapé
 * institucional. Ligar/desligar e as fotos/trechos ficam em Editar site › Rodapé (`src/lib/site/footer-experience.ts`).
 * Texto vazio = a linha some (o título, se apagado, também).
 */
const footerExperience = z.object({
  title: text(120),
  subtitle: text(200),
  /** Legenda curta embaixo da câmera. */
  cameraCaption: text(120),
  /** Legenda curta embaixo do celular. */
  phoneCaption: text(120),
  /** Frase da composição gráfica (foto instantânea e tela do celular) enquanto não há fotos/trechos cadastrados. */
  frameText: text(80),
  /** Aviso de que é uma simulação (nada é gravado, a câmera do aparelho não é usada). */
  simulationNote: text(240),
});

// ===================================================================== 404
const notFoundPage = z.object({ eyebrow: text(80), title: text(160), text: text(300), cta: link });

// ===================================================================== SEO
const pageSeo = z.object({ title: text(70), description: text(180) });
const seo = z.object({
  /** Sufixo dos títulos: "Serviços · NÓS Studio". */
  siteName: text(60),
  /** Imagem de compartilhamento (WhatsApp, Instagram, etc.). Vazio = imagem gerada com a marca. */
  shareImageMediaId: mediaId,
  /** Código de verificação do Google Search Console (só o valor do content). */
  googleVerification: text(120),
  pages: z.object({
    home: pageSeo,
    sobre: pageSeo,
    servicos: pageSeo,
    pacotes: pageSeo,
    casamentos: pageSeo,
    portfolio: pageSeo,
    contato: pageSeo,
  }),
});

export const siteContentSchemas = {
  general,
  navigation,
  visibility,
  home,
  about,
  differentials,
  howItWorks,
  servicesPage,
  packagesPage,
  weddingsPage,
  portfolioPage,
  contactPage,
  privacyPage,
  termsPage: legalPage,
  cookiesPage: legalPage,
  visitCounter,
  footerExperience,
  notFoundPage,
  seo,
} as const;

export type SiteContentKey = keyof typeof siteContentSchemas;
export const SITE_CONTENT_KEYS = Object.keys(siteContentSchemas) as SiteContentKey[];
export type SiteContent = { [K in SiteContentKey]: z.infer<(typeof siteContentSchemas)[K]> };
export type SiteLink = z.infer<typeof link>;
export type FounderContent = z.infer<typeof founder>;

/** Rótulos das seções no editor do painel. */
export const SITE_CONTENT_LABELS: Record<SiteContentKey, string> = {
  general: "Contato e redes",
  navigation: "Menu e rodapé",
  visibility: "Páginas visíveis",
  home: "Página inicial",
  about: "Sobre a NÓS",
  differentials: "Diferenciais",
  howItWorks: "Processo de atendimento",
  servicesPage: "Páginas de serviços",
  packagesPage: "Página de planos",
  weddingsPage: "Eventos e Casamentos",
  portfolioPage: "Página de portfólio",
  contactPage: "Contato e orçamento",
  privacyPage: "Política de privacidade",
  termsPage: "Termos de uso",
  cookiesPage: "Política de cookies",
  visitCounter: "Contador de visitas",
  footerExperience: "Rodapé interativo",
  notFoundPage: "Página não encontrada (404)",
  seo: "SEO e compartilhamento",
};

// ================================================================== PADRÕES
const PRIVACY_BODY = `Esta política explica, de forma direta, como a **{{marca}}** trata os dados pessoais de quem visita este site ou entra em contato com a gente. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

## Quem é responsável pelos dados

A {{marca}} é a controladora dos dados pessoais coletados neste site. Para qualquer assunto sobre privacidade, fale com a gente: {{email}}.

## Quais dados coletamos

Dados pessoais, só os que você nos envia pelos formulários de contato, orçamento e consulta de data:

- nome e, se informada, a empresa;
- WhatsApp;
- e-mail (opcional);
- serviço ou plano de interesse e o objetivo do projeto (quando informados);
- conforme o tipo de pedido: segmento e perfil do negócio nas redes; tipo e previsão da produção; ou tipo, data, horário, cidade, local, número de convidados e serviços desejados para o evento;
- a descrição que você escrever sobre a sua ideia.

Não pedimos documentos, dados bancários nem dados sensíveis pelo site. Por favor, não inclua esse tipo de informação na mensagem.

Além disso, o site conta as visitas de forma agregada e anônima — veja "Medição de visitas", abaixo.

## Para que usamos

- **Responder ao seu pedido** de contato ou orçamento e preparar uma proposta — tratamento necessário para procedimentos preliminares a um contrato, a seu pedido (LGPD, art. 7º, V).
- **Dar continuidade ao atendimento** e, se fecharmos um projeto, executar o que foi combinado (art. 7º, V).
- **Cumprir obrigações legais** e resguardar direitos, quando necessário (art. 7º, II e VI).

Não usamos seus dados para enviar publicidade sem a sua autorização e não vendemos dados pessoais.

## Medição de visitas

Para saber quantas visitas o site recebe e quais páginas são mais procuradas, usamos uma medição própria: sem serviços de terceiros (não há Google Analytics, Meta Pixel nem similares) e sem cookies.

A cada página aberta, o seu navegador envia ao nosso servidor o endereço da página, o domínio do site de onde você veio (por exemplo, "instagram.com" — nunca o endereço completo), a largura da tela e, se o link tiver, as marcações de campanha (utm). Com o seu endereço IP e a identificação do navegador, o servidor calcula na hora um código anônimo, usado só para não contar a mesma visita duas vezes e para barrar abusos. O IP e a identificação do navegador não são gravados. O código é embaralhado com uma chave aleatória que muda todos os dias e é apagada em seguida: depois disso, não é possível ligar uma visita a outro dia nem chegar ao seu IP a partir dele.

O que fica guardado são totais por dia: visitas, visitantes estimados, páginas vistas, origem (acesso direto, busca, redes sociais, outros sites ou campanha), tipo de aparelho, cliques nos botões de WhatsApp e nos banners e quantidade de formulários enviados. Os registros de cada visita, já sem IP, são apagados depois de 30 dias. Esses números não identificam você, não formam um perfil seu, não são compartilhados com terceiros e não são usados para publicidade. O total de visitas pode ser exibido no próprio site.

Fazemos essa contagem com base no legítimo interesse de entender e melhorar o site (LGPD, art. 7º, IX), usando o mínimo de dados.

## Com quem compartilhamos

Seus dados ficam restritos à equipe da {{marca}} que cuida do atendimento. Usamos fornecedores de tecnologia (hospedagem do site, banco de dados e e-mail) que tratam os dados em nosso nome, apenas para manter o serviço funcionando. Se você optar por conversar pelo WhatsApp ou Instagram, valem também as políticas dessas plataformas.

## Por quanto tempo guardamos

Pedidos de orçamento que não viram projeto são mantidos por até 12 meses após o último contato e depois eliminados. Dados de clientes são mantidos durante a relação comercial e pelos prazos legais aplicáveis. A contagem de visitas segue os prazos descritos em "Medição de visitas".

## Cookies

Este site não usa cookies de publicidade nem de rastreamento, e a medição de visitas também não usa cookies. Os detalhes estão na [Política de Cookies](/cookies).

## Seus direitos

Você pode, a qualquer momento, pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização ou eliminação, portabilidade, informação sobre compartilhamento e revogação de consentimento. Basta escrever para {{email}}. Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).

## Segurança

Adotamos medidas técnicas e administrativas para proteger os dados: conexão criptografada (HTTPS), acesso restrito por login individual, senhas armazenadas com criptografia forte e cópias de segurança.

## Atualizações

Esta política pode ser atualizada para refletir mudanças no site ou na legislação. A data da versão vigente aparece no topo da página.`;

const TERMS_BODY = `Estes termos explicam as regras de uso do site da **{{marca}}**. Ao navegar por aqui, você concorda com eles.

## O que é este site

O site apresenta a {{marca}}, seus serviços e planos, e oferece formulários para pedir contato, orçamento ou consultar uma data. Ele também dá acesso às áreas privadas de clientes e da equipe, que exigem login.

## Pedidos de contato e orçamento

Enviar um formulário não cria um contrato, não reserva data e não garante disponibilidade. Serviços, entregas, prazos e valores só ficam combinados em proposta e contrato aceitos pelas duas partes.

As informações do site (descrições de serviços e planos, por exemplo) podem mudar sem aviso e não substituem a proposta enviada a cada cliente.

## Conteúdo e direitos autorais

Textos, marca, logotipo, fotografias, vídeos e demais materiais deste site pertencem à {{marca}} ou aos seus clientes e parceiros, que autorizaram a exibição. Não é permitido copiar, reproduzir ou usar esse conteúdo para fins comerciais sem autorização por escrito.

## Áreas privadas

O acesso às áreas de clientes e da equipe é pessoal e intransferível. Guarde a sua senha, não a compartilhe e avise a gente se suspeitar de uso indevido da sua conta.

## Uso adequado

Não use o site para enviar conteúdo ilegal ou ofensivo, tentar acessar áreas sem autorização, nem prejudicar o funcionamento do serviço.

## Links para outros sites

O site pode levar a serviços de terceiros, como WhatsApp, Instagram, YouTube e Vimeo. Cada um tem os seus próprios termos e políticas.

## Privacidade

O tratamento de dados pessoais está descrito na [Política de Privacidade](/privacidade) e o uso de cookies, na [Política de Cookies](/cookies).

## Contato

Dúvidas sobre estes termos: {{email}}.

## Atualizações

Estes termos podem ser atualizados. A versão vigente aparece no topo da página.`;

const COOKIES_BODY = `Esta página explica o que a **{{marca}}** guarda no seu navegador quando você usa este site.

## Resumo

O site público não usa cookies de publicidade, de rastreamento nem de estatísticas de terceiros. A contagem de visitas é feita pelo próprio site, sem cookies e sem guardar nada no seu navegador. Por isso não há um aviso de consentimento de cookies: não existe nada opcional para aceitar ou recusar.

## Site público

Navegar pelas páginas públicas não grava cookies. Guardamos apenas uma preferência no armazenamento local do seu navegador: a informação de que você fechou um aviso do topo da página, para ele não voltar a aparecer. Essa informação não identifica você e não é enviada para a gente.

## Contagem de visitas (sem cookies)

Para saber quantas visitas o site recebe, usamos uma medição própria, sem serviços de terceiros. Ela não grava cookies nem qualquer outro dado no seu navegador: a cada página aberta, o navegador apenas avisa o nosso servidor, que soma a visita aos totais do dia. O seu endereço IP não é guardado. Os detalhes estão na [Política de Privacidade](/privacidade), em "Medição de visitas".

## Áreas privadas (login)

Quem entra na Área do Cliente, na Área da Equipe ou no painel usa cookies estritamente necessários:

- **cookie de sessão** — mantém você conectado depois do login e é apagado quando você sai ou a sessão expira;
- **cookie de dispositivo** — ajuda a proteger o login contra tentativas indevidas de acesso;
- **cookie de aviso** — guarda por instantes a mensagem de confirmação de uma ação ("alterações salvas", por exemplo).

Sem eles, o login não funciona. Eles não são usados para publicidade.

## Conteúdo de terceiros

Vídeos do YouTube e do Vimeo só são carregados quando você clica para assistir. A partir daí, valem as políticas dessas plataformas. Os links para WhatsApp e Instagram abrem os serviços dessas empresas, que têm as suas próprias regras.

## Como controlar

Você pode apagar cookies e dados de sites nas configurações do seu navegador. Se bloquear os cookies deste site, a navegação pública continua funcionando; apenas o login das áreas privadas deixa de funcionar.

## Mudanças

Se o site passar a usar outros cookies (de estatísticas de terceiros ou de publicidade, por exemplo), esta página será atualizada antes e, quando a lei exigir, o seu consentimento será pedido.

## Contato

Dúvidas: {{email}}. Veja também a [Política de Privacidade](/privacidade).`;

export const defaultSiteContent: SiteContent = {
  general: {
    brandName: "NÓS Studio",
    tagline: "Sua história, nosso olhar.",
    descriptor: "Marketing, comunicação e audiovisual",
    whatsapp: "",
    whatsappMessage: "Olá, NÓS! Conheci o trabalho de vocês pelo site e gostaria de conversar sobre um projeto.",
    email: "",
    instagram: "@nosstudio.cria",
    socialLinks: [],
    serviceArea: "",
    copyright: "Todos os direitos reservados.",
  },

  navigation: {
    home: "Início",
    about: "Sobre a NÓS",
    services: "Serviços",
    plans: "Planos",
    portfolio: "Portfólio",
    events: "Eventos e Casamentos",
    contact: "Contato",
    clientArea: "Área do Cliente",
    cta: { label: "Solicitar proposta", href: "/contato#formulario" },
  },

  visibility: {
    // No lançamento: portfólio e depoimentos ficam ocultos até existirem trabalhos e relatos reais e autorizados.
    portfolio: false,
    testimonials: false,
    faq: true,
    packages: true,
    weddings: true,
    whatsappFloat: true,
  },

  home: {
    hero: {
      eyebrow: "Marketing • Conteúdo • Audiovisual",
      title: "Sua história, nosso olhar.",
      lead: "Toda marca tem uma essência. Toda pessoa tem uma história. E toda história merece ser contada de um jeito único.",
      text: "Na NÓS Studio, unimos criatividade, estratégia e audiovisual para transformar ideias em conexões reais.",
      primaryCta: { label: "Conheça nossos serviços", href: "/servicos" },
      secondaryCta: { label: "Vamos criar juntos", href: "/contato" },
      mediaId: null,
      mediaCaption: "",
    },
    highlights: {
      eyebrow: "O que fazemos",
      title: "Criatividade, estratégia e audiovisual no mesmo olhar.",
      text: "",
      cta: { label: "Conheça todos os serviços", href: "/servicos" },
    },
    founders: {
      eyebrow: "Sobre a NÓS",
      title: "Antes de existir a NÓS, já existia um nós.",
      text: [
        "Algumas histórias começam com uma ideia. A nossa começou com uma conexão.",
        "Somos Pedro Henrique e Laura Nepomuceno, dois empreendedores que encontraram na comunicação, na criatividade e no audiovisual uma oportunidade de construir algo juntos.",
      ].join("\n\n"),
      cta: { label: "Conheça nossa história", href: "/sobre" },
    },
    packages: {
      eyebrow: "Planos",
      title: "Um plano para cada momento da sua marca.",
      text: "",
      cta: { label: "Comparar os planos", href: "/planos" },
    },
    standalone: {
      eyebrow: "Serviços avulsos",
      title: "Precisa de algo pontual?",
      text: "Também atendemos por diária e por projeto.",
      cta: { label: "Ver serviços avulsos", href: "/planos#planos-avulsos" },
    },
    events: {
      eyebrow: "Eventos e Casamentos",
      title: "Existem momentos que passam. E histórias que *permanecem.*",
      text: "",
      cta: { label: "Consultar disponibilidade da minha data", href: "/eventos-e-casamentos#eventos-formulario" },
    },
    portfolio: {
      eyebrow: "Portfólio",
      title: "Nosso olhar em prática.",
      text: "",
      cta: { label: "Ver todos os projetos", href: "/portfolio" },
    },
    testimonials: { eyebrow: "Clientes e depoimentos", title: "Quem viveu, conta." },
    faq: {
      eyebrow: "Perguntas frequentes",
      title: "Ficou com alguma dúvida?",
      cta: { label: "Fale com a gente", href: "/contato" },
    },
    closing: {
      title: "Toda história merece ser vista de um jeito especial.",
      text: "A próxima pode ser a sua.",
      question: "Vamos criar algo juntos?",
      cta: { label: "Vamos conversar", href: "/contato" },
      signature: "NÓS Studio — Marketing, comunicação e audiovisual.",
    },
  },

  // Briefing v2, seção 05 — texto copiado do documento (só as quebras de parágrafo foram acrescentadas).
  about: {
    eyebrow: "Sobre a NÓS",
    title: "Antes de existir a NÓS, já existia um nós.",
    intro: [
      "Algumas histórias começam com uma ideia. A nossa começou com uma conexão.",
      "Somos Pedro Henrique e Laura Nepomuceno, dois empreendedores que encontraram na comunicação, na criatividade e no audiovisual uma oportunidade de construir algo juntos. A NÓS Studio nasceu da união das nossas experiências profissionais, das nossas diferentes maneiras de enxergar o mundo e da vontade de transformar ideias em projetos que realmente façam sentido.",
      "Acreditamos que comunicar vai muito além de aparecer. É sobre criar conexões, transmitir sentimentos e fazer com que pessoas e marcas sejam reconhecidas por aquilo que as torna únicas. Por isso, unimos estratégia, criatividade e produção audiovisual em um mesmo lugar.",
      "Mais do que uma empresa de marketing, somos parceiros de quem tem uma história para contar. Sua história, nosso olhar.",
    ].join("\n\n"),
    coupleMediaId: null,
    foundersTitle: "Quem está por trás da NÓS?",
    founders: [
      {
        name: "Pedro Henrique",
        role: "Cofundador | Marketing, Estratégia e Audiovisual",
        shortBio: "Na NÓS, reúne experiência em negócios, estratégia e audiovisual.",
        bio: [
          "Empresário no segmento de brindes personalizados, com trajetória profissional iniciada em 2016 e atuação em campanhas de comunicação desde 2018.",
          "Possui experiências em gestão, planejamento estratégico, comunicação institucional, marketing digital, organização de eventos e produção audiovisual. Também atuou na formação de alunos nas áreas de comunicação e criação de conteúdo.",
          "Na NÓS, reúne experiência em negócios, estratégia e audiovisual.",
        ].join("\n\n"),
        mediaId: null,
      },
      {
        name: "Laura Nepomuceno",
        role: "Cofundadora | Criação, Comunicação e Audiovisual",
        shortBio: "Na NÓS, une criatividade, sensibilidade e visão empreendedora.",
        bio: [
          "Empresária na área da educação, com seis anos de experiência no universo do marketing e atuação profissional nos últimos dois anos.",
          "Sua trajetória reúne empreendedorismo, comunicação digital, criação de conteúdo, gravação e edição de vídeos.",
          "Na NÓS, une criatividade, sensibilidade e visão empreendedora.",
        ].join("\n\n"),
        mediaId: null,
      },
    ],
    // Blocos do texto anterior (briefing v1): continuam editáveis, mas nascem vazios — bloco vazio não aparece.
    why: { title: "", text: "" },
    manifesto: { text: "", closing: "" },
    mission: {
      title: "Missão",
      text: "Transformar ideias e histórias em estratégias de comunicação que gerem conexões, reconhecimento e valor.",
    },
    vision: {
      title: "Visão",
      text: "Ser reconhecida pela criatividade, qualidade audiovisual e soluções personalizadas.",
    },
    values: {
      eyebrow: "Missão, visão e valores",
      title: "Valores",
      items: [
        { title: "Criatividade", text: "" },
        { title: "Autenticidade", text: "" },
        { title: "Comprometimento", text: "" },
        { title: "Transparência", text: "" },
        { title: "Parceria", text: "" },
        { title: "Evolução constante", text: "" },
      ],
    },
    essence: { title: "", text: "", signature: "" },
  },

  // Briefing v2, seção 03: os seis diferenciais (o documento traz só os títulos).
  differentials: {
    eyebrow: "Diferenciais",
    title: "O que você encontra na NÓS.",
    items: [
      { title: "Estratégia antes da criação", text: "" },
      { title: "Atendimento próximo", text: "" },
      { title: "Comunicação integrada", text: "" },
      { title: "Criatividade com intenção", text: "" },
      { title: "Audiovisual alinhado à marca", text: "" },
      { title: "Planejamento orientado aos objetivos", text: "" },
    ],
  },

  // Briefing v2, seção 03: conexão, estratégia, planejamento, produção e entrega (só os nomes das etapas).
  howItWorks: {
    eyebrow: "Processo de atendimento",
    title: "Do primeiro contato à entrega, a gente caminha junto.",
    steps: [
      { title: "Conexão", text: "" },
      { title: "Estratégia", text: "" },
      { title: "Planejamento", text: "" },
      { title: "Produção", text: "" },
      { title: "Entrega", text: "" },
    ],
    closing: "Você traz a história. NÓS encontramos o olhar.",
  },

  servicesPage: {
    eyebrow: "Serviços",
    title: "Tudo o que a sua história precisa para ser bem contada.",
    intro: "Estratégia, criatividade e produção audiovisual em um mesmo lugar.",
    detailLabel: "Ver o serviço",
    closingTitle: "Não sabe por onde começar?",
    closingText: "Conte sua ideia. Vamos encontrar juntos a melhor maneira de transformá-la em realidade.",
    cta: { label: "Solicitar orçamento", href: "/contato#formulario" },
    detail: {
      deliverablesTitle: "Possíveis entregas",
      benefitsTitle: "Benefícios",
      mediaTitle: "Em imagens",
      relatedTitle: "Trabalhos relacionados",
      faqTitle: "Perguntas frequentes",
      quoteTitle: "Vamos conversar sobre o seu projeto?",
      quoteText: "Conte sua ideia. Vamos encontrar juntos a melhor maneira de transformá-la em realidade.",
      othersTitle: "Outros serviços",
      pageLinkLabel: "Ver a página completa",
    },
  },

  packagesPage: {
    eyebrow: "Planos",
    title: "Um plano para cada momento da sua marca.",
    intro: "Planos mensais para quem quer comunicar com consistência e serviços avulsos para necessidades pontuais.",
    recommendedLabel: "Recomendado",
    priceOnRequestLabel: "Investimento personalizado para o seu negócio.",
    note: "Entregas, quantidades e investimento são definidos em proposta personalizada, de acordo com o momento de cada marca.",
    comparison: {
      enabled: true,
      title: "Compare os planos",
      intro: "",
    },
    standaloneTitle: "Serviços avulsos",
    standaloneIntro: "Precisa de algo pontual? Também atendemos por diária e por projeto.",
    closingTitle: "Vamos montar o seu?",
    closingText: "Conte o que você precisa e receba uma proposta feita para o seu momento.",
    cta: { label: "Solicitar proposta", href: "/contato#formulario" },
  },

  weddingsPage: {
    eyebrow: "Eventos e Casamentos",
    title: "Existem momentos que passam. E histórias que *permanecem.*",
    lead: "Histórias, experiências e momentos únicos registrados com sensibilidade e criatividade.",
    ctaLabel: "Consultar disponibilidade da minha data",
    heroMediaId: null,
    events: {
      eyebrow: "Eventos",
      title: "Eventos corporativos e sociais",
      text: "Foto, filme, storymaker e conteúdo em tempo real para eventos empresariais e sociais.",
      items: [
        { title: "Cobertura fotográfica", text: "" },
        { title: "Filmagem profissional", text: "" },
        { title: "Storymaker", text: "" },
        { title: "Conteúdo em tempo real", text: "" },
        { title: "Vídeo de melhores momentos", text: "" },
      ],
    },
    weddingsEyebrow: "Casamentos",
    approach: {
      title: "Um dos dias mais importantes da vida merece um olhar único.",
      text: [
        "Antes de pensar em câmeras, a gente quer conhecer vocês: como se encontraram, o que não pode faltar, o que faz desse dia o de vocês.",
        "No casamento, registramos os momentos espontâneos e contamos a história do casal com sensibilidade — do making of ao último abraço da festa.",
      ].join("\n\n"),
    },
    coverage: {
      title: "O que a cobertura pode incluir",
      intro: "Cada casamento é único. A proposta de vocês define o que entra na cobertura.",
      items: [
        { title: "Fotografia do casamento", text: "Cerimônia, festa e os detalhes que contam a história do dia." },
        { title: "Filme cinematográfico", text: "O dia de vocês em um filme para rever e reviver." },
        { title: "Making of dos noivos", text: "Os bastidores e a expectativa antes do sim." },
        { title: "Ensaio pré-wedding", text: "Um ensaio do casal antes do grande dia." },
        { title: "Teaser vertical", text: "Um vídeo curto, no formato das redes sociais." },
        { title: "Filme de melhores momentos", text: "Os pontos altos da celebração em poucos minutos." },
        { title: "Galeria digital", text: "Suas fotos organizadas e entregues por link." },
      ],
      note: "Os itens e as condições de cada cobertura são detalhados em proposta personalizada.",
    },
    proposal: {
      title: "Como funciona a proposta",
      text: "Sem tabela pronta: a proposta é feita para a celebração de vocês.",
      steps: [
        { title: "Vocês contam", text: "Data, local, tamanho da celebração e o que sonham para o registro." },
        { title: "A gente conversa", text: "Entendemos o estilo de vocês e tiramos as dúvidas." },
        {
          title: "Proposta personalizada",
          text: "Vocês recebem um documento com a cobertura, as entregas, as condições e o investimento.",
        },
      ],
    },
    galleryTitle: "Histórias que já passaram pelo nosso olhar.",
    form: {
      title: "Conte sobre a sua data.",
      text: "Preencha o que já souber. O restante a gente descobre junto.",
      submitLabel: "Consultar disponibilidade da minha data",
      note: "O envio não reserva a data nem confirma a contratação: a gente confere a agenda e responde com a disponibilidade.",
    },
  },

  portfolioPage: {
    eyebrow: "Portfólio",
    title: "Nosso olhar em prática.",
    intro: "Marcas, pessoas e momentos que confiaram sua história à NÓS.",
    emptyText: "Estamos preparando os primeiros projetos para mostrar aqui.",
    projectsLabel: "Projetos",
    searchLabel: "Buscar projetos",
    searchPlaceholder: "Projeto, cliente ou serviço",
    allLabel: "Todos",
    featuredLabel: "Destaque",
    noResultsTitle: "Nenhum projeto encontrado.",
    noResultsText: "Tente outra palavra ou veja todos os projetos.",
    clearLabel: "Ver todos os projetos",
    detail: {
      backLabel: "Voltar ao portfólio",
      aboutTitle: "O projeto",
      caseTitle: "Estudo de caso",
      objectiveTitle: "Objetivo",
      challengeTitle: "Desafio",
      solutionTitle: "Solução",
      resultsTitle: "Resultados",
      videoTitle: "Vídeo",
      galleryTitle: "Galeria",
      beforeAfterTitle: "Antes e depois",
      beforeLabel: "Antes",
      afterLabel: "Depois",
      backstageTitle: "Bastidores",
      relatedTitle: "Projetos relacionados",
      shareTitle: "Compartilhar este projeto",
      previousTitle: "Experiência anterior",
      previousText: "Este trabalho foi realizado antes da criação da NÓS Studio e faz parte da experiência profissional dos fundadores.",
    },
  },

  contactPage: {
    eyebrow: "Contato e orçamento",
    title: "Toda grande história começa com uma conversa.",
    text: "Conte sua ideia. Vamos encontrar juntos a melhor maneira de transformá-la em realidade.",
    submitLabel: "Enviar meu projeto",
    consentText:
      "Concordo que a NÓS Studio use os dados que informei para responder ao meu pedido de contato e orçamento.",
    successTitle: "Recebemos o seu projeto!",
    successText: "Obrigado por contar sua história para a gente. Vamos responder o quanto antes.",
    whatsappLabel: "Chamar no WhatsApp",
    instagramLabel: "Seguir no Instagram",
  },

  privacyPage: {
    title: "Política de Privacidade",
    version: "2026-11.3",
    body: PRIVACY_BODY,
  },

  termsPage: {
    title: "Termos de Uso",
    version: "2026-11",
    body: TERMS_BODY,
  },

  cookiesPage: {
    title: "Política de Cookies",
    version: "2026-11.1",
    body: COOKIES_BODY,
  },

  // Briefing v2, seção 11: frase do briefing; a legenda identifica a métrica e desde quando ela é contada.
  visitCounter: {
    enabled: false,
    minimum: "",
    phrase: "Cada visita é o começo de uma nova história.",
    label: "visitas ao site desde {{inicio}}",
  },

  // Briefing v2, seção 11: título, subtítulo e a frase da marca vêm do briefing; as legendas e o aviso de
  // simulação foram redigidos para a revisão dos sócios.
  footerExperience: {
    title: "Antes de ir, deixe sua marca.",
    subtitle: "Porque toda conexão merece ser registrada.",
    cameraCaption: "Clique na câmera e revele uma foto instantânea.",
    phoneCaption: "Aperte REC e grave um take com a gente.",
    frameText: "Sua história, nosso olhar.",
    simulationNote: "É uma simulação: a câmera e o microfone do seu aparelho não são usados e nada é gravado.",
  },

  // Briefing v2, seção 31.
  notFoundPage: {
    eyebrow: "Erro 404",
    title: "Esse take saiu do roteiro.",
    text: "Mas toda boa história tem uma segunda tomada.",
    cta: { label: "Voltar para o início", href: "/" },
  },

  seo: {
    siteName: "NÓS Studio",
    shareImageMediaId: null,
    googleVerification: "",
    pages: {
      home: {
        title: "NÓS Studio — Marketing, comunicação e audiovisual",
        description:
          "Sua história, nosso olhar. Unimos criatividade, estratégia e audiovisual para transformar ideias em conexões reais.",
      },
      sobre: {
        title: "Sobre a NÓS",
        description:
          "Antes de existir a NÓS, já existia um nós. Conheça Pedro Henrique e Laura Nepomuceno, fundadores da NÓS Studio.",
      },
      servicos: {
        title: "Serviços",
        description:
          "Marketing e estratégia, redes sociais, audiovisual, fotografia, design gráfico, identidade visual, tráfego pago, eventos e casamentos.",
      },
      pacotes: {
        title: "Planos",
        description: "Plano Essencial, Plano Integrado e Plano Estratégico, além de serviços avulsos por diária e por projeto.",
      },
      casamentos: {
        title: "Eventos e Casamentos",
        description:
          "Fotografia e filme para eventos corporativos, sociais e casamentos. Consulte a disponibilidade da sua data.",
      },
      portfolio: {
        title: "Portfólio",
        description: "Nosso olhar em prática: projetos de marketing, audiovisual, fotografia, design, eventos e casamentos.",
      },
      contato: {
        title: "Contato e orçamento",
        description: "Toda grande história começa com uma conversa. Conte sua ideia para a NÓS Studio.",
      },
    },
  },
};

// ------------------------------------------------------------------- merge
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Mescla o valor salvo sobre os padrões (objetos recursivamente; arrays e primitivos substituem). */
function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return result;
}

/**
 * Resolve uma seção: valor salvo (possivelmente antigo/incompleto) + padrões → objeto válido.
 * Se o valor salvo estiver corrompido, cai nos padrões em vez de quebrar o site.
 */
export function resolveSiteContent<K extends SiteContentKey>(key: K, stored: unknown): SiteContent[K] {
  const fallback = defaultSiteContent[key];
  if (stored === undefined || stored === null) return fallback;
  const parsed = siteContentSchemas[key].safeParse(deepMerge(fallback, stored));
  return parsed.success ? (parsed.data as SiteContent[K]) : fallback;
}

/** Substitui `{{marca}}` e `{{email}}` no texto das páginas legais (privacidade, termos e cookies). */
export function fillPrivacyPlaceholders(body: string, general: SiteContent["general"]): string {
  const email = general.email || "pelos canais de contato deste site";
  return body.replaceAll("{{marca}}", general.brandName).replaceAll("{{email}}", email);
}
