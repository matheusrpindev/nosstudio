/**
 * Modelo do conteúdo editável do site público.
 *
 * Cada chave de `siteContentSchemas` é uma "seção" guardada na tabela `site_content` (JSON) e editada no
 * painel em /painel/site. `defaultSiteContent` traz a copy original do briefing dos sócios — é o que o site
 * mostra enquanto ninguém editou nada.
 *
 * Arquivo puro (sem acesso a banco): pode ser importado no servidor e no cliente.
 * Leitura no servidor: `getSiteContent()` em src/server/site/queries.ts.
 */
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
});

// ============================================================= VISIBILIDADE
/** Liga/desliga seções e itens do menu. Blocos sem conteúdo publicado somem sozinhos mesmo ligados. */
const visibility = z.object({
  portfolio: z.boolean(), // página /portfolio, item do menu e bloco na home
  testimonials: z.boolean(), // depoimentos
  faq: z.boolean(),
  packages: z.boolean(), // página /pacotes, item do menu e bloco na home
  weddings: z.boolean(), // página /casamentos e item do menu
  founders: z.boolean(), // bloco dos fundadores na home
  howItWorks: z.boolean(),
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
  highlights: z.object({
    eyebrow: text(80),
    title: text(160),
    items: z.array(z.object({ title: text(80), text: text(300), href: text(300) })).max(6),
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
  values: z.object({ eyebrow: text(80), title: text(160), items: z.array(titled).max(8) }),
  essence: z.object({ title: text(160), text: longText(4000), signature: text(240) }),
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
  closingTitle: text(200),
  closingText: text(400),
  cta: link,
});

// ================================================================= PACOTES
const packagesPage = z.object({
  eyebrow: text(80),
  title: text(160),
  intro: text(600),
  recommendedLabel: text(40),
  /** Aviso sob os planos (condições definidas em proposta). */
  note: text(400),
  standaloneTitle: text(160),
  standaloneIntro: text(400),
  closingTitle: text(200),
  closingText: text(400),
  cta: link,
});

// ============================================================== CASAMENTOS
const weddingsPage = z.object({
  eyebrow: text(80),
  title: text(160),
  lead: text(400),
  approach: z.object({ title: text(160), text: longText(3000) }),
  coverage: z.object({
    title: text(160),
    intro: text(400),
    /** O que a cobertura pode incluir. */
    items: z.array(titled).max(12),
    note: text(400),
  }),
  proposal: z.object({ title: text(160), text: longText(2000), steps: z.array(titled).max(6) }),
  form: z.object({ title: text(160), text: text(400), submitLabel: text(60) }),
  heroMediaId: mediaId,
});

// =============================================================== PORTFÓLIO
const portfolioPage = z.object({
  eyebrow: text(80),
  title: text(160),
  intro: text(600),
  emptyText: text(300),
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
  visibility,
  home,
  about,
  howItWorks,
  servicesPage,
  packagesPage,
  weddingsPage,
  portfolioPage,
  contactPage,
  privacyPage,
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
  visibility: "Visibilidade das seções",
  home: "Página inicial",
  about: "Quem Somos",
  howItWorks: "Como funciona",
  servicesPage: "Página de serviços",
  packagesPage: "Página de pacotes",
  weddingsPage: "Página de casamentos",
  portfolioPage: "Página de portfólio",
  contactPage: "Contato e orçamento",
  privacyPage: "Política de privacidade",
  seo: "SEO e compartilhamento",
};

// ================================================================== PADRÕES
const PRIVACY_BODY = `Esta política explica, de forma direta, como a **{{marca}}** trata os dados pessoais de quem visita este site ou entra em contato com a gente. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

## Quem é responsável pelos dados

A {{marca}} é a controladora dos dados pessoais coletados neste site. Para qualquer assunto sobre privacidade, fale com a gente: {{email}}.

## Quais dados coletamos

Coletamos apenas o que você nos envia pelo formulário de contato e orçamento:

- nome;
- WhatsApp;
- e-mail (opcional);
- serviço de interesse, data e cidade do evento ou projeto (quando informados);
- a descrição que você escrever sobre a sua ideia.

Não pedimos documentos, dados bancários nem dados sensíveis pelo site. Por favor, não inclua esse tipo de informação na mensagem.

## Para que usamos

- **Responder ao seu pedido** de contato ou orçamento e preparar uma proposta — tratamento necessário para procedimentos preliminares a um contrato, a seu pedido (LGPD, art. 7º, V).
- **Dar continuidade ao atendimento** e, se fecharmos um projeto, executar o que foi combinado (art. 7º, V).
- **Cumprir obrigações legais** e resguardar direitos, quando necessário (art. 7º, II e VI).

Não usamos seus dados para enviar publicidade sem a sua autorização e não vendemos dados pessoais.

## Com quem compartilhamos

Seus dados ficam restritos aos sócios da {{marca}}. Usamos fornecedores de tecnologia (hospedagem do site, banco de dados e e-mail) que tratam os dados em nosso nome, apenas para manter o serviço funcionando. Se você optar por conversar pelo WhatsApp ou Instagram, valem também as políticas dessas plataformas.

## Por quanto tempo guardamos

Pedidos de orçamento que não viram projeto são mantidos por até 12 meses após o último contato e depois eliminados. Dados de clientes são mantidos durante a relação comercial e pelos prazos legais aplicáveis.

## Cookies

Este site não usa cookies de publicidade nem de rastreamento. Usamos apenas armazenamento essencial ao funcionamento — por exemplo, para lembrar que você fechou um aviso.

## Seus direitos

Você pode, a qualquer momento, pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização ou eliminação, portabilidade, informação sobre compartilhamento e revogação de consentimento. Basta escrever para {{email}}. Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).

## Segurança

Adotamos medidas técnicas e administrativas para proteger os dados: conexão criptografada (HTTPS), acesso restrito por login individual, senhas armazenadas com criptografia forte e cópias de segurança.

## Atualizações

Esta política pode ser atualizada para refletir mudanças no site ou na legislação. A data da versão vigente aparece no topo da página.`;

export const defaultSiteContent: SiteContent = {
  general: {
    brandName: "NÓS Studio",
    tagline: "Sua história, nosso olhar.",
    descriptor: "Marketing, comunicação e audiovisual",
    whatsapp: "",
    whatsappMessage: "Olá! Vim pelo site da NÓS Studio e quero conversar sobre um projeto.",
    email: "",
    instagram: "@nosstudio.cria",
    socialLinks: [],
    serviceArea: "",
  },

  visibility: {
    // No lançamento: portfólio e depoimentos ficam ocultos até existirem trabalhos e relatos reais e autorizados.
    portfolio: false,
    testimonials: false,
    faq: true,
    packages: true,
    weddings: true,
    founders: true,
    howItWorks: true,
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
      items: [
        {
          title: "Produção Audiovisual",
          text: "Vídeos, fotografia e produções criativas para marcas, pessoas e eventos.",
          href: "/servicos#video",
        },
        {
          title: "Marketing & Redes Sociais",
          text: "Estratégias, planejamento e conteúdos para construir uma presença digital de verdade.",
          href: "/servicos#marketing",
        },
        {
          title: "Eventos & Casamentos",
          text: "Histórias, experiências e momentos únicos registrados com sensibilidade e criatividade.",
          href: "/servicos#eventos",
        },
      ],
      cta: { label: "Conheça todos os serviços", href: "/servicos" },
    },
    founders: {
      eyebrow: "Quem somos",
      title: "Antes de existir a NÓS, já existia um nós.",
      text: [
        "A NÓS Studio nasceu muito antes de ganhar um nome, uma identidade visual ou se tornar uma empresa.",
        "Nasceu da conexão entre duas pessoas: Pedro Henrique e Laura Nepomuceno. Um casal que encontrou, além da parceria na vida, a possibilidade de construir algo junto.",
        "Nós dois temos formas de enxergar, criar e sentir. E foi justamente nessa união que encontramos a força para transformar nossa paixão pela comunicação e pelo audiovisual em um projeto maior.",
      ].join("\n\n"),
      cta: { label: "Conheça nossa história", href: "/sobre" },
    },
    packages: {
      eyebrow: "Pacotes e planos",
      title: "Um plano para cada momento da sua marca.",
      text: "Do primeiro passo à presença completa: planos mensais e serviços avulsos, sempre com proposta personalizada.",
      cta: { label: "Ver pacotes", href: "/pacotes" },
    },
    portfolio: {
      eyebrow: "Portfólio",
      title: "Histórias que já passaram pelo nosso olhar.",
      text: "",
      cta: { label: "Ver todos os projetos", href: "/portfolio" },
    },
    testimonials: { eyebrow: "Depoimentos", title: "Quem viveu, conta." },
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

  about: {
    eyebrow: "Quem somos",
    title: "Antes de existir a NÓS, já existia um nós.",
    intro: [
      "Algumas histórias começam com uma ideia. A nossa começou com uma conexão.",
      "Somos Pedro Henrique e Laura Nepomuceno. Dois profissionais, dois olhares e uma vontade em comum: transformar criatividade, comunicação e audiovisual em algo que fosse verdadeiramente nosso.",
      "A NÓS Studio nasceu da união das nossas histórias, das experiências que construímos individualmente e dos sonhos que decidimos compartilhar.",
      "Mais do que abrir uma empresa, queríamos criar um espaço onde nossas ideias pudessem se encontrar e onde cada cliente tivesse sua história compreendida, valorizada e contada de uma maneira única.",
      "Porque antes de sermos uma marca, somos pessoas que acreditam no poder das conexões.",
    ].join("\n\n"),
    coupleMediaId: null,
    foundersTitle: "Quem está por trás da NÓS?",
    founders: [
      {
        name: "Pedro Henrique",
        role: "Cofundador | Marketing, Estratégia e Audiovisual",
        shortBio:
          "Atua com marketing, comunicação, criação de conteúdo e produção audiovisual. Une visão estratégica e criatividade para transformar ideias em projetos de comunicação.",
        bio: [
          "Minha trajetória profissional começou em 2016 e, desde então, tive a oportunidade de atuar em diferentes áreas, desenvolvendo uma visão ampla sobre pessoas, comunicação, gestão e negócios.",
          "Passei por projetos institucionais, ações de comunicação, campanhas, gestão de iniciativas e organização de eventos. Experiências que me ensinaram que comunicar bem vai muito além de produzir algo bonito: é preciso entender o público, ter estratégia e transmitir a mensagem certa.",
          "Com o tempo, ampliei minha atuação para o marketing digital e a produção audiovisual, trabalhando com planejamento de conteúdo, roteiros, redes sociais, gravações, edição de vídeos e campanhas de comunicação.",
          "Também encontrei na educação uma forma de compartilhar conhecimento, atuando na formação de pessoas em marketing digital, criação de conteúdo e comunicação.",
          "Hoje, reúno essa bagagem para desenvolver projetos que conectem criatividade, estratégia e resultados.",
        ].join("\n\n"),
        mediaId: null,
      },
      {
        name: "Laura Nepomuceno",
        role: "Cofundadora | Criação e Produção Audiovisual",
        shortBio:
          "Atua na criação e produção de conteúdos audiovisuais, contribuindo com sensibilidade, criatividade e um olhar próprio para o desenvolvimento dos projetos.",
        bio: [
          "Laura traz para a NÓS sua experiência com criação de conteúdo, gravação e edição de vídeos, contribuindo com um olhar criativo para a maneira como cada história é construída e apresentada.",
          "Sua atuação também passa pelo universo do empreendedorismo, incluindo a participação como palestrante em uma atividade sobre empreendedorismo feminino.",
          "Na NÓS, participa da construção das ideias e dos projetos audiovisuais, unindo criação, sensibilidade e atenção à identidade de cada trabalho.",
          "Seu olhar complementa a visão estratégica e criativa da empresa, ajudando a transformar ideias em conteúdos que tenham personalidade e significado.",
        ].join("\n\n"),
        mediaId: null,
      },
    ],
    why: {
      title: "Por que nasceu a NÓS?",
      text: [
        "Porque percebemos que nossas experiências poderiam construir algo maior quando estivessem juntas.",
        "A NÓS nasceu do desejo de empreender como casal e transformar o que sabemos fazer em um negócio com propósito.",
        "Queríamos ir além de simplesmente oferecer vídeos, fotografias ou publicações para redes sociais.",
        "Queríamos participar das histórias.",
        "Entender o sonho de quem está começando um negócio. Valorizar o trabalho de quem construiu uma marca. Registrar a emoção de quem está vivendo um momento único.",
        "Foi assim que encontramos nosso propósito: usar a comunicação, o marketing e o audiovisual para aproximar pessoas, marcas e histórias.",
        "O nome NÓS representa exatamente isso.",
        "Representa nossa parceria como casal, mas também a conexão que queremos construir com cada cliente.",
        "Porque quando alguém confia sua história à NÓS, ela passa a fazer parte da nossa também.",
      ].join("\n\n"),
    },
    manifesto: {
      text: [
        "Porque acreditamos que uma boa imagem não é apenas aquela que impressiona. É aquela que comunica, transmite sentimentos e faz sentido para quem está do outro lado.",
        "Queremos conhecer pessoas, entender negócios, descobrir histórias e encontrar novas maneiras de contá-las.",
        "Seja uma empresa construindo sua marca, um profissional compartilhando seu trabalho ou um casal vivendo um dos dias mais importantes da vida.",
        "Cada história merece um olhar único.",
      ].join("\n\n"),
      closing: "E é por isso que existimos. Para unir o nosso olhar à sua história.",
    },
    values: {
      eyebrow: "Nosso jeito de trabalhar",
      title: "Quatro coisas que levamos para todo projeto.",
      items: [
        { title: "Conexão", text: "Acreditamos que grandes projetos começam com boas relações." },
        { title: "Criatividade", text: "Buscamos caminhos que valorizem a identidade de cada cliente." },
        { title: "Estratégia", text: "Cada produção precisa ter um objetivo e uma intenção." },
        {
          title: "Parceria",
          text: "Gostamos de construir junto, ouvindo, entendendo e participando de cada etapa.",
        },
      ],
    },
    essence: {
      title: "Sua história, nosso olhar.",
      text: [
        "Essa frase traduz a essência da NÓS Studio.",
        "**Sua história**, porque cada pessoa, empresa e momento tem algo único para contar.",
        "**Nosso olhar**, porque usamos nossa experiência, criatividade e sensibilidade para encontrar a melhor maneira de transformar essa história em comunicação.",
        "Não queremos que todas as marcas pareçam iguais.",
        "Queremos que cada uma seja reconhecida por aquilo que a torna especial.",
      ].join("\n\n"),
      signature: "NÓS Studio. Mais do que produzir conteúdo, queremos fazer parte da sua história.",
    },
  },

  howItWorks: {
    eyebrow: "Como funciona",
    title: "Do primeiro contato à entrega, a gente caminha junto.",
    steps: [
      { title: "Primeiro contato", text: "Você conta sua ideia, necessidade e objetivo." },
      {
        title: "Entendemos seu projeto",
        text: "Conversamos, fazemos perguntas e identificamos a melhor solução.",
      },
      {
        title: "Proposta personalizada",
        text: "Apresentamos os serviços, entregas, condições e investimento.",
      },
      { title: "Planejamento e produção", text: "Organizamos as etapas e executamos o trabalho." },
      {
        title: "Entrega e acompanhamento",
        text: "Entregamos os materiais e acompanhamos os resultados quando o serviço contratado incluir essa etapa.",
      },
    ],
    closing: "Você traz a história. NÓS encontramos o olhar.",
  },

  servicesPage: {
    eyebrow: "Serviços",
    title: "Tudo o que a sua história precisa para ser bem contada.",
    intro:
      "Fotografia, vídeo, marketing e cobertura de eventos — juntos ou separados, sempre com um objetivo e uma intenção.",
    closingTitle: "Não sabe por onde começar?",
    closingText: "Conte sua ideia. Vamos encontrar juntos a melhor maneira de transformá-la em realidade.",
    cta: { label: "Solicitar orçamento", href: "/contato" },
  },

  packagesPage: {
    eyebrow: "Pacotes e planos",
    title: "Um plano para cada momento da sua marca.",
    intro:
      "Planos mensais para quem quer comunicar com consistência e serviços avulsos para necessidades pontuais.",
    recommendedLabel: "Recomendado",
    note: "Entregas, quantidades e investimento são definidos em proposta personalizada, de acordo com o momento de cada marca.",
    standaloneTitle: "Serviços avulsos",
    standaloneIntro: "Precisa de algo pontual? Também atendemos por diária e por projeto.",
    closingTitle: "Vamos montar o seu?",
    closingText: "Conte o que você precisa e receba uma proposta feita para o seu momento.",
    cta: { label: "Solicitar orçamento", href: "/contato" },
  },

  weddingsPage: {
    eyebrow: "Casamentos",
    title: "Vamos eternizar a sua história?",
    lead: "Histórias, experiências e momentos únicos registrados com sensibilidade e criatividade.",
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
      text: "Sem tabela pronta: a proposta é feita para o casamento de vocês.",
      steps: [
        { title: "Vocês contam", text: "Data, local, tamanho da celebração e o que sonham para o registro." },
        { title: "A gente conversa", text: "Entendemos o estilo de vocês e tiramos as dúvidas." },
        {
          title: "Proposta personalizada",
          text: "Vocês recebem um documento com a cobertura, as entregas, as condições e o investimento.",
        },
      ],
    },
    form: {
      title: "Contem sobre o grande dia",
      text: "Preencham o que já souberem. O restante a gente descobre junto.",
      submitLabel: "Pedir proposta de casamento",
    },
    heroMediaId: null,
  },

  portfolioPage: {
    eyebrow: "Portfólio",
    title: "Histórias que já passaram pelo nosso olhar.",
    intro: "Marcas, pessoas e momentos que confiaram sua história à NÓS.",
    emptyText: "Estamos preparando os primeiros projetos para mostrar aqui.",
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
    version: "2026-11",
    body: PRIVACY_BODY,
  },

  seo: {
    siteName: "NÓS Studio",
    shareImageMediaId: null,
    googleVerification: "",
    pages: {
      home: {
        title: "NÓS Studio — Marketing, conteúdo e audiovisual",
        description:
          "Sua história, nosso olhar. Unimos criatividade, estratégia e audiovisual para transformar ideias em conexões reais.",
      },
      sobre: {
        title: "Quem Somos",
        description:
          "Antes de existir a NÓS, já existia um nós. Conheça Pedro Henrique e Laura Nepomuceno, o casal por trás da NÓS Studio.",
      },
      servicos: {
        title: "Serviços",
        description:
          "Fotografia, vídeo e produção audiovisual, marketing e redes sociais, eventos e casamentos.",
      },
      pacotes: {
        title: "Pacotes e planos",
        description:
          "Planos mensais Começo, Presença e Destaque, além de serviços avulsos por diária e por projeto.",
      },
      casamentos: {
        title: "Casamentos",
        description:
          "Fotografia e filme de casamento, making of, pré-wedding e galeria digital, com proposta personalizada.",
      },
      portfolio: {
        title: "Portfólio",
        description: "Projetos de marketing, fotografia, vídeo, eventos e casamentos da NÓS Studio.",
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

/** Substitui `{{marca}}` e `{{email}}` no texto da política de privacidade. */
export function fillPrivacyPlaceholders(body: string, general: SiteContent["general"]): string {
  const email = general.email || "pelos canais de contato deste site";
  return body.replaceAll("{{marca}}", general.brandName).replaceAll("{{email}}", email);
}
