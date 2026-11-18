/**
 * Mapa do editor de textos do site: para cada seção de `siteContentSchemas`, os grupos (blocos da página) e,
 * em cada grupo, os campos com rótulo humano, tipo de controle e ajuda.
 *
 * Arquivo PURO (sem servidor e sem React): usado pelo formulário (cliente), pela Server Action e pelo teste que
 * garante que nenhum campo do schema ficou sem edição. Se alguém acrescentar um campo ao schema de
 * `src/lib/site/content.ts`, o teste `config.test.ts` falha até ele ser mapeado aqui.
 *
 * O limite de caracteres NÃO é escrito à mão: vem do próprio schema zod (`maxLengthAt`).
 */
import { siteContentSchemas, SITE_CONTENT_LABELS, type SiteContentKey } from "@/lib/site/content";

// ---------------------------------------------------------------- tipos
/** Campo dentro de um item de lista (ex.: um passo do "Como funciona"). */
export type ItemField = {
  key: string;
  type: "text" | "textarea" | "markdown" | "href" | "image";
  label: string;
  hint?: string;
  /** Proporção da prévia das imagens ("1/1", "4/5"…). */
  aspect?: string;
};

type Base = { path: string; label: string; hint?: string; required?: boolean };

export type LineField = Base & { type: "text" | "email" | "phone" | "instagram"; placeholder?: string };
export type AreaField = Base & { type: "textarea" | "markdown"; rows?: number; placeholder?: string };
export type ListField = Base & {
  type: "list";
  /** "passo", "valor"… — usado em "Adicionar passo", "Passo 2". */
  itemName: string;
  addLabel: string;
  items: ItemField[];
};

export type Field =
  | LineField
  | AreaField
  | (Base & { type: "switch" })
  /** Objeto `{ label, href }`: dois campos (texto do botão e destino). */
  | (Base & { type: "link" })
  | (Base & { type: "image"; aspect?: string })
  | ListField
  /** Objeto `{ title, description }` de SEO de uma página, com contador e prévia do Google. */
  | (Base & { type: "seoPage"; publicPath: string });

export type Group = {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
};

export type SectionConfig = {
  key: SiteContentKey;
  title: string;
  /** Uma frase para o índice de seções. */
  summary: string;
  /** Página pública onde essa seção aparece ("Ver no site"). */
  publicPath: string;
  groups: Group[];
  /** Aviso fixo no topo do formulário. */
  notice?: { tone: "info" | "alerta"; title?: string; text: string };
};

/** Páginas do site, para o campo de link (sugestões) e para a prévia de SEO. */
export const SITE_PAGES = [
  { href: "/", label: "Página inicial" },
  { href: "/sobre", label: "Quem somos" },
  { href: "/servicos", label: "Serviços" },
  { href: "/pacotes", label: "Pacotes e planos" },
  { href: "/casamentos", label: "Casamentos" },
  { href: "/portfolio", label: "Portfólio" },
  { href: "/contato", label: "Contato e orçamento" },
  { href: "/privacidade", label: "Política de privacidade" },
] as const;


// ------------------------------------------------------- atalhos de escrita
const text = (path: string, label: string, hint?: string, extra: Partial<Base> = {}): Field => ({ type: "text", path, label, hint, ...extra });
const area = (path: string, label: string, hint?: string, rows = 3, extra: Partial<Base> = {}): Field => ({ type: "textarea", path, label, hint, rows, ...extra });
const md = (path: string, label: string, hint?: string, rows = 8, extra: Partial<Base> = {}): Field => ({ type: "markdown", path, label, hint, rows, ...extra });
const toggle = (path: string, label: string, hint?: string): Field => ({ type: "switch", path, label, hint });
const link = (path: string, label: string, hint?: string): Field => ({ type: "link", path, label, hint });
const image = (path: string, label: string, hint?: string, aspect = "16/9"): Field => ({ type: "image", path, label, hint, aspect });
const eyebrow = (hint = "Pequena frase em letras maiúsculas acima do título."): Field => text("eyebrow", "Chamada acima do título", hint);

/** Aplica um prefixo de caminho a campos escritos com caminho relativo. */
function within(prefix: string, fields: Field[]): Field[] {
  return fields.map((field) => ({ ...field, path: `${prefix}.${field.path}` }));
}

const titledItems: ItemField[] = [
  { key: "title", type: "text", label: "Título" },
  { key: "text", type: "textarea", label: "Texto" },
];

// ------------------------------------------------------------------ seções
export const SITE_SECTIONS: Record<SiteContentKey, SectionConfig> = {
  // ------------------------------------------------------------ geral
  general: {
    key: "general",
    title: SITE_CONTENT_LABELS.general,
    summary: "Nome da marca, WhatsApp, e-mail, Instagram, outras redes e região de atendimento.",
    publicPath: "/contato",
    groups: [
      {
        id: "marca",
        title: "Marca",
        description: "Aparece no topo e no rodapé do site, na aba do navegador e na política de privacidade.",
        fields: [
          text("brandName", "Nome da marca", "Usado em todo o site no lugar de “NÓS Studio”.", { required: true }),
          text("tagline", "Frase da marca", "Slogan que acompanha o nome (ex.: no rodapé e nas prévias de compartilhamento)."),
          text("descriptor", "Descrição curta", "O que a marca faz, em poucas palavras. Aparece no rodapé."),
        ],
      },
      {
        id: "whatsapp",
        title: "WhatsApp",
        description: "Sem número, todos os botões de WhatsApp somem do site — o formulário de contato continua funcionando.",
        fields: [
          {
            type: "phone",
            path: "whatsapp",
            label: "Número do WhatsApp comercial",
            hint: "Com DDD. Sem número cadastrado, os botões de WhatsApp ficam ocultos no site.",
          },
          area(
            "whatsappMessage",
            "Mensagem que já vem escrita",
            "É o texto que aparece pronto quando a pessoa abre a conversa pelo site. Ela pode alterar antes de enviar.",
            3,
          ),
        ],
      },
      {
        id: "contato",
        title: "E-mail e redes sociais",
        description: "Aparecem no rodapé e na página de contato. Deixe em branco o que ainda não existir: o item some do site.",
        fields: [
          { type: "email", path: "email", label: "E-mail de contato", hint: "Também preenche o {{email}} da política de privacidade." },
          { type: "instagram", path: "instagram", label: "Instagram", hint: "O @ do perfil, por exemplo @nosstudio.cria." },
          {
            type: "list",
            path: "socialLinks",
            label: "Outras redes",
            hint: "TikTok, YouTube, LinkedIn, Pinterest… Cada rede vira um link no rodapé.",
            itemName: "rede",
            addLabel: "Adicionar rede",
            items: [
              { key: "label", type: "text", label: "Nome da rede (ex.: TikTok)" },
              { key: "href", type: "href", label: "Link do perfil" },
            ],
          },
        ],
      },
      {
        id: "atendimento",
        title: "Região de atendimento",
        fields: [
          text("serviceArea", "Cidade ou região atendida", "Ex.: “Atendemos toda a região metropolitana de Curitiba”. Vazio = não aparece no site."),
        ],
      },
    ],
  },

  // ------------------------------------------------------- visibilidade
  visibility: {
    key: "visibility",
    title: SITE_CONTENT_LABELS.visibility,
    summary: "Liga e desliga páginas, itens do menu e blocos do site.",
    publicPath: "/",
    notice: {
      tone: "info",
      title: "Blocos vazios não aparecem",
      text: "Mesmo com a chave ligada, um bloco sem conteúdo publicado não aparece no site (nem o título, nem o link do menu). Por exemplo: o Portfólio só surge quando houver pelo menos um projeto publicado.",
    },
    groups: [
      {
        id: "paginas",
        title: "Páginas e itens do menu",
        description: "Desligar uma página a tira do menu, da página inicial e do mapa do site.",
        fields: [
          toggle("portfolio", "Portfólio", "Página /portfolio, item no menu e bloco na página inicial. Começa desligado: ligue quando houver projetos reais e autorizados."),
          toggle("packages", "Pacotes e planos", "Página /pacotes, item no menu e bloco na página inicial."),
          toggle("weddings", "Casamentos", "Página /casamentos e item no menu."),
        ],
      },
      {
        id: "blocos",
        title: "Blocos da página inicial",
        fields: [
          toggle("founders", "Fundadores", "Bloco “Quem somos” com Pedro Henrique e Laura na página inicial."),
          toggle("howItWorks", "Como funciona", "Bloco com as etapas do primeiro contato à entrega."),
          toggle("testimonials", "Depoimentos", "Bloco com o que os clientes dizem. Só aparece com depoimentos publicados e autorizados pelo cliente."),
          toggle("faq", "Perguntas frequentes", "Bloco de dúvidas comuns. Só aparecem as perguntas publicadas."),
        ],
      },
      {
        id: "whatsapp",
        title: "WhatsApp",
        fields: [
          toggle("whatsappFloat", "Botão flutuante de WhatsApp", "Botão redondo fixo no canto da tela, no celular. Só aparece se o número do WhatsApp estiver cadastrado em “Contato e redes”."),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- home
  home: {
    key: "home",
    title: SITE_CONTENT_LABELS.home,
    summary: "Todos os blocos da página inicial: topo, serviços em destaque, fundadores, pacotes e fechamento.",
    publicPath: "/",
    groups: [
      {
        id: "hero",
        title: "Topo da página (hero)",
        description: "A primeira coisa que o visitante vê.",
        fields: [
          ...within("hero", [
            eyebrow(),
            text("title", "Título principal", "A frase grande do topo.", { required: true }),
            area("lead", "Frase de apoio", "Logo abaixo do título."),
            area("text", "Texto complementar", "Segundo parágrafo do topo."),
            link("primaryCta", "Botão principal"),
            link("secondaryCta", "Botão secundário"),
            image("mediaId", "Foto ou imagem do topo", "Opcional. Sem imagem, o site usa a composição gráfica da marca. Prefira foto horizontal.", "16/9"),
            text("mediaCaption", "Legenda da imagem", "Pequeno texto sobre a imagem. Opcional."),
          ]),
        ],
      },
      {
        id: "destaques",
        title: "Serviços em destaque",
        description: "Faixa com até 6 cartões logo abaixo do topo. O catálogo completo fica em Editar site → Serviços.",
        fields: within("highlights", [
          eyebrow(),
          text("title", "Título do bloco"),
          {
            type: "list",
            path: "items",
            label: "Cartões",
            hint: "Cada cartão tem um título, uma frase e um link (ex.: /servicos#video).",
            itemName: "cartão",
            addLabel: "Adicionar cartão",
            items: [
              { key: "title", type: "text", label: "Título" },
              { key: "text", type: "textarea", label: "Texto" },
              { key: "href", type: "href", label: "Link do cartão" },
            ],
          },
          link("cta", "Botão do bloco"),
        ]),
      },
      {
        id: "fundadores",
        title: "Fundadores",
        description: "Bloco “Quem somos” da página inicial. Aparece se “Fundadores” estiver ligado em Visibilidade. Fotos e bios ficam em Quem Somos.",
        fields: within("founders", [
          eyebrow(),
          text("title", "Título do bloco"),
          md("text", "Texto de apresentação", "Parágrafos separados por uma linha em branco.", 8),
          link("cta", "Botão do bloco"),
        ]),
      },
      {
        id: "pacotes",
        title: "Pacotes e planos",
        description: "Aparece se “Pacotes e planos” estiver ligado em Visibilidade. Os planos em si ficam em Editar site → Pacotes.",
        fields: within("packages", [eyebrow(), text("title", "Título do bloco"), area("text", "Texto do bloco"), link("cta", "Botão do bloco")]),
      },
      {
        id: "portfolio",
        title: "Portfólio",
        description: "Aparece se o Portfólio estiver ligado em Visibilidade e houver projetos publicados.",
        fields: within("portfolio", [
          eyebrow(),
          text("title", "Título do bloco"),
          area("text", "Texto do bloco", "Opcional."),
          link("cta", "Botão do bloco"),
        ]),
      },
      {
        id: "depoimentos",
        title: "Depoimentos",
        description: "Aparece se Depoimentos estiver ligado em Visibilidade e houver depoimentos publicados.",
        fields: within("testimonials", [eyebrow(), text("title", "Título do bloco")]),
      },
      {
        id: "faq",
        title: "Perguntas frequentes",
        description: "Aparece se Perguntas frequentes estiver ligado em Visibilidade e houver perguntas publicadas para a página inicial.",
        fields: within("faq", [eyebrow(), text("title", "Título do bloco"), link("cta", "Botão do bloco")]),
      },
      {
        id: "fechamento",
        title: "Fechamento",
        description: "Faixa final da página, logo antes do rodapé.",
        fields: within("closing", [
          text("title", "Título"),
          text("text", "Frase de apoio"),
          text("question", "Pergunta de convite", "Ex.: “Vamos criar algo juntos?”."),
          link("cta", "Botão"),
          text("signature", "Assinatura", "Linha pequena no fim da faixa."),
        ]),
      },
    ],
  },

  // --------------------------------------------------------------- about
  about: {
    key: "about",
    title: SITE_CONTENT_LABELS.about,
    summary: "História da NÓS, fotos e bios de Pedro Henrique e Laura, valores e manifesto.",
    publicPath: "/sobre",
    groups: [
      {
        id: "abertura",
        title: "Abertura",
        description: "Topo da página Quem Somos.",
        fields: [
          eyebrow(),
          text("title", "Título da página", undefined, { required: true }),
          md("intro", "Texto de abertura", "Parágrafos separados por uma linha em branco. Dá para usar **negrito** e listas.", 10),
          image("coupleMediaId", "Foto do casal", "Foto de Pedro e Laura juntos. Aparece na abertura da página.", "4/5"),
        ],
      },
      {
        id: "fundadores",
        title: "Fundadores",
        description: "Cada pessoa tem foto, resumo (usado nos cartões da página inicial) e bio completa (usada nesta página).",
        fields: [
          text("foundersTitle", "Título do bloco"),
          {
            type: "list",
            path: "founders",
            label: "Pessoas",
            hint: "A ordem aqui é a ordem no site. Use as setas para trocar.",
            itemName: "pessoa",
            addLabel: "Adicionar pessoa",
            items: [
              { key: "name", type: "text", label: "Nome" },
              { key: "role", type: "text", label: "Cargo ou descrição curta" },
              { key: "mediaId", type: "image", label: "Foto", hint: "Foto de rosto ou meio corpo. Quadrada ou vertical funciona melhor.", aspect: "4/5" },
              { key: "shortBio", type: "textarea", label: "Resumo (cartão da página inicial)" },
              { key: "bio", type: "markdown", label: "Bio completa (esta página)" },
            ],
          },
        ],
      },
      {
        id: "porque",
        title: "Por que nasceu a NÓS",
        fields: within("why", [text("title", "Título"), md("text", "Texto", "Parágrafos separados por uma linha em branco.", 10)]),
      },
      {
        id: "manifesto",
        title: "Manifesto",
        description: "Trecho em destaque da página.",
        fields: within("manifesto", [md("text", "Texto do manifesto", undefined, 8), text("closing", "Frase final")]),
      },
      {
        id: "valores",
        title: "Valores",
        fields: within("values", [
          eyebrow(),
          text("title", "Título do bloco"),
          {
            type: "list",
            path: "items",
            label: "Valores",
            hint: "Até 8. Cada um tem um título e uma frase.",
            itemName: "valor",
            addLabel: "Adicionar valor",
            items: titledItems,
          },
        ]),
      },
      {
        id: "essencia",
        title: "Essência",
        description: "Fecho da página.",
        fields: within("essence", [
          text("title", "Título"),
          md("text", "Texto", "Use **negrito** para destacar trechos.", 8),
          text("signature", "Assinatura"),
        ]),
      },
    ],
  },

  // ---------------------------------------------------------- howItWorks
  howItWorks: {
    key: "howItWorks",
    title: SITE_CONTENT_LABELS.howItWorks,
    summary: "As etapas do primeiro contato à entrega.",
    publicPath: "/",
    groups: [
      {
        id: "bloco",
        title: "Bloco “Como funciona”",
        description: "Aparece na página inicial se “Como funciona” estiver ligado em Visibilidade.",
        fields: [
          eyebrow(),
          text("title", "Título do bloco"),
          {
            type: "list",
            path: "steps",
            label: "Etapas",
            hint: "Até 8 etapas, na ordem em que acontecem.",
            itemName: "etapa",
            addLabel: "Adicionar etapa",
            items: titledItems,
          },
          text("closing", "Frase final", "Fecha o bloco, depois das etapas."),
        ],
      },
    ],
  },

  // --------------------------------------------------------- servicesPage
  servicesPage: {
    key: "servicesPage",
    title: SITE_CONTENT_LABELS.servicesPage,
    summary: "Textos de abertura e fechamento da página de serviços.",
    publicPath: "/servicos",
    notice: { tone: "info", text: "Os serviços em si (título, descrição, itens e fotos) são editados em Editar site → Serviços." },
    groups: [
      {
        id: "topo",
        title: "Topo da página",
        fields: [eyebrow(), text("title", "Título da página", undefined, { required: true }), area("intro", "Texto de abertura", undefined, 3)],
      },
      {
        id: "fechamento",
        title: "Fechamento",
        description: "Faixa no fim da página, depois da lista de serviços.",
        fields: [text("closingTitle", "Título"), area("closingText", "Texto"), link("cta", "Botão")],
      },
    ],
  },

  // --------------------------------------------------------- packagesPage
  packagesPage: {
    key: "packagesPage",
    title: SITE_CONTENT_LABELS.packagesPage,
    summary: "Textos da página de pacotes e planos. Valores e entregas ficam em Editar site → Pacotes.",
    publicPath: "/pacotes",
    notice: { tone: "info", text: "Enquanto nenhum valor estiver cadastrado, os pacotes aparecem como “Sob consulta”. Os planos em si (nome, entregas, valor) são editados em Editar site → Pacotes." },
    groups: [
      {
        id: "topo",
        title: "Topo da página",
        fields: [eyebrow(), text("title", "Título da página", undefined, { required: true }), area("intro", "Texto de abertura", undefined, 3)],
      },
      {
        id: "planos",
        title: "Planos mensais",
        fields: [
          text("recommendedLabel", "Etiqueta do plano recomendado", "Selo que aparece no plano marcado como recomendado."),
          area("note", "Aviso sob os planos", "Explica que entregas, quantidades e investimento são definidos em proposta."),
        ],
      },
      {
        id: "avulsos",
        title: "Serviços avulsos",
        fields: [text("standaloneTitle", "Título do bloco"), area("standaloneIntro", "Texto do bloco")],
      },
      {
        id: "fechamento",
        title: "Fechamento",
        fields: [text("closingTitle", "Título"), area("closingText", "Texto"), link("cta", "Botão")],
      },
    ],
  },

  // --------------------------------------------------------- weddingsPage
  weddingsPage: {
    key: "weddingsPage",
    title: SITE_CONTENT_LABELS.weddingsPage,
    summary: "Página de casamentos: abordagem, cobertura, como funciona a proposta e formulário.",
    publicPath: "/casamentos",
    groups: [
      {
        id: "topo",
        title: "Topo da página",
        fields: [
          eyebrow(),
          text("title", "Título da página", undefined, { required: true }),
          area("lead", "Frase de apoio"),
          image("heroMediaId", "Foto do topo", "Opcional. Uma foto de casamento real e autorizada. Prefira horizontal.", "16/9"),
        ],
      },
      {
        id: "abordagem",
        title: "Nossa abordagem",
        fields: within("approach", [text("title", "Título"), md("text", "Texto", "Parágrafos separados por uma linha em branco.", 8)]),
      },
      {
        id: "cobertura",
        title: "O que a cobertura pode incluir",
        fields: within("coverage", [
          text("title", "Título"),
          area("intro", "Texto de abertura"),
          {
            type: "list",
            path: "items",
            label: "Itens da cobertura",
            hint: "Até 12. Lista do que pode entrar na proposta (sem preços).",
            itemName: "item",
            addLabel: "Adicionar item",
            items: titledItems,
          },
          area("note", "Observação sob a lista"),
        ]),
      },
      {
        id: "proposta",
        title: "Como funciona a proposta",
        fields: within("proposal", [
          text("title", "Título"),
          md("text", "Texto", undefined, 4),
          {
            type: "list",
            path: "steps",
            label: "Etapas",
            hint: "Até 6.",
            itemName: "etapa",
            addLabel: "Adicionar etapa",
            items: titledItems,
          },
        ]),
      },
      {
        id: "formulario",
        title: "Formulário de casamento",
        fields: within("form", [text("title", "Título"), area("text", "Texto"), text("submitLabel", "Texto do botão de enviar")]),
      },
    ],
  },

  // -------------------------------------------------------- portfolioPage
  portfolioPage: {
    key: "portfolioPage",
    title: SITE_CONTENT_LABELS.portfolioPage,
    summary: "Textos da página de portfólio. Os projetos ficam em Editar site → Portfólio.",
    publicPath: "/portfolio",
    notice: { tone: "info", text: "A página só aparece no site quando o Portfólio estiver ligado em Visibilidade e houver projetos publicados." },
    groups: [
      {
        id: "topo",
        title: "Textos da página",
        fields: [
          eyebrow(),
          text("title", "Título da página", undefined, { required: true }),
          area("intro", "Texto de abertura"),
          area("emptyText", "Texto quando ainda não há projetos", "Mostrado se a página for aberta sem nenhum projeto publicado."),
        ],
      },
    ],
  },

  // --------------------------------------------------------- contactPage
  contactPage: {
    key: "contactPage",
    title: SITE_CONTENT_LABELS.contactPage,
    summary: "Textos do formulário de contato, consentimento (LGPD) e mensagem de sucesso.",
    publicPath: "/contato",
    groups: [
      {
        id: "topo",
        title: "Topo da página",
        fields: [eyebrow(), text("title", "Título da página", undefined, { required: true }), area("text", "Texto de abertura")],
      },
      {
        id: "formulario",
        title: "Formulário",
        fields: [
          text("submitLabel", "Texto do botão de enviar", undefined, { required: true }),
          area(
            "consentText",
            "Texto do consentimento (LGPD)",
            "A pessoa precisa marcar esta caixa para enviar. O link para a política de privacidade é acrescentado automaticamente ao final.",
            3,
            { required: true },
          ),
        ],
      },
      {
        id: "sucesso",
        title: "Depois de enviar",
        description: "Mensagem mostrada quando o formulário é enviado com sucesso.",
        fields: [text("successTitle", "Título"), area("successText", "Texto")],
      },
      {
        id: "botoes",
        title: "Botões de contato direto",
        description: "O botão de WhatsApp só aparece se houver número cadastrado em Contato e redes.",
        fields: [text("whatsappLabel", "Texto do botão de WhatsApp"), text("instagramLabel", "Texto do botão de Instagram")],
      },
    ],
  },

  // --------------------------------------------------------- privacyPage
  privacyPage: {
    key: "privacyPage",
    title: SITE_CONTENT_LABELS.privacyPage,
    summary: "Texto da política de privacidade (LGPD) e versão.",
    publicPath: "/privacidade",
    notice: {
      tone: "alerta",
      title: "Texto-base sugerido: revise com assessoria jurídica antes de publicar",
      text: "Este texto foi escrito como ponto de partida. Antes de divulgar o site, peça a um advogado ou assessoria jurídica para conferir se ele descreve exatamente como a NÓS trata os dados. Os marcadores {{marca}} e {{email}} são preenchidos automaticamente com o nome da marca e o e-mail cadastrados em “Contato e redes”.",
    },
    groups: [
      {
        id: "politica",
        title: "Política de privacidade",
        fields: [
          text("title", "Título da página", undefined, { required: true }),
          text(
            "version",
            "Versão ou data",
            "Aparece na página e é gravada junto com o consentimento de cada pessoa que envia o formulário. Mude sempre que alterar o texto (ex.: 2026-11).",
            { required: true },
          ),
          md(
            "body",
            "Texto da política",
            "Use ## para títulos de seção, - para listas e **negrito**. {{marca}} e {{email}} são preenchidos automaticamente.",
            24,
            { required: true },
          ),
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- seo
  seo: {
    key: "seo",
    title: SITE_CONTENT_LABELS.seo,
    summary: "Como o site aparece no Google e quando é compartilhado no WhatsApp e no Instagram.",
    publicPath: "/",
    groups: [
      {
        id: "geral",
        title: "Geral",
        fields: [
          text("siteName", "Nome do site nos resultados", "Vem depois do título de cada página: “Serviços · NÓS Studio”.", { required: true }),
          image(
            "shareImageMediaId",
            "Imagem de compartilhamento",
            "Aparece quando alguém envia o link do site no WhatsApp, Instagram ou redes. Ideal: 1200×630 px. Sem imagem, o site gera uma com a marca.",
            "1200/630",
          ),
          text(
            "googleVerification",
            "Código de verificação do Google",
            "Só o valor do campo content que o Google Search Console fornece. Deixe vazio se não usar.",
          ),
        ],
      },
      {
        id: "paginas",
        title: "Título e descrição de cada página",
        description: "É o que aparece como resultado de busca no Google. Mantenha o título curto e a descrição clara.",
        fields: [
          { type: "seoPage", path: "pages.home", label: "Página inicial", publicPath: "/", required: true },
          { type: "seoPage", path: "pages.sobre", label: "Quem Somos", publicPath: "/sobre", required: true },
          { type: "seoPage", path: "pages.servicos", label: "Serviços", publicPath: "/servicos", required: true },
          { type: "seoPage", path: "pages.pacotes", label: "Pacotes e planos", publicPath: "/pacotes", required: true },
          { type: "seoPage", path: "pages.casamentos", label: "Casamentos", publicPath: "/casamentos", required: true },
          { type: "seoPage", path: "pages.portfolio", label: "Portfólio", publicPath: "/portfolio", required: true },
          { type: "seoPage", path: "pages.contato", label: "Contato e orçamento", publicPath: "/contato", required: true },
        ],
      },
    ],
  },
};

// ------------------------------------------------------------- utilidades
export function isSiteContentKey(value: string): value is SiteContentKey {
  return Object.hasOwn(siteContentSchemas, value);
}

export const SECTION_ORDER: readonly SiteContentKey[] = [
  "general",
  "visibility",
  "home",
  "about",
  "howItWorks",
  "servicesPage",
  "packagesPage",
  "weddingsPage",
  "portfolioPage",
  "contactPage",
  "privacyPage",
  "seo",
];

/** Todos os campos de uma seção, na ordem de exibição. */
export function sectionFields(section: SectionConfig): Field[] {
  return section.groups.flatMap((group) => group.fields);
}

// ------------------------------------------------- introspecção do schema
// Lê a estrutura dos schemas zod 4 (`_zod.def`) para (a) descobrir o limite de caracteres de cada campo e
// (b) listar todas as "folhas" do schema, que o teste compara com o que o mapa cobre.
type ZodNode = {
  _zod: { def: { type: string; shape?: Record<string, ZodNode>; element?: ZodNode; innerType?: ZodNode; checks?: { _zod: { def: { check?: string; maximum?: number } } }[] } };
};

function unwrap(node: ZodNode): ZodNode {
  let current = node;
  while (current._zod.def.innerType) current = current._zod.def.innerType;
  return current;
}

/** Schema de um caminho com pontos (`hero.title`); `[]` entra nos itens de uma lista (`items[].title`). */
function schemaAt(key: SiteContentKey, path: string): ZodNode | null {
  let node: ZodNode = siteContentSchemas[key] as unknown as ZodNode;
  for (const part of path.split(".")) {
    const isList = part.endsWith("[]");
    const name = isList ? part.slice(0, -2) : part;
    node = unwrap(node);
    const next = node._zod.def.shape?.[name];
    if (!next) return null;
    node = isList ? (unwrap(next)._zod.def.element ?? next) : next;
  }
  return unwrap(node);
}

/** Limite de caracteres de um texto — ou de itens de uma lista — (ou `null` se não houver). `path` aceita `lista[].campo`. */
export function maxLengthAt(key: SiteContentKey, path: string): number | null {
  const check = schemaAt(key, path)?._zod.def.checks?.find((c) => c._zod.def.check === "max_length");
  return check?._zod.def.maximum ?? null;
}

/** Folhas do schema de uma seção: `hero.title`, `items[].title`, `pages.home.description`… */
export function schemaLeaves(key: SiteContentKey): string[] {
  const out: string[] = [];
  const walk = (node: ZodNode, prefix: string) => {
    const inner = unwrap(node);
    const def = inner._zod.def;
    if (def.type === "object" && def.shape) {
      for (const [name, child] of Object.entries(def.shape)) walk(child, prefix ? `${prefix}.${name}` : name);
    } else if (def.type === "array" && def.element) {
      const element = unwrap(def.element);
      if (element._zod.def.type === "object") walk(element, `${prefix}[]`);
      else out.push(`${prefix}[]`);
    } else {
      out.push(prefix);
    }
  };
  walk(siteContentSchemas[key] as unknown as ZodNode, "");
  return out;
}

/** Folhas cobertas pelo mapa de uma seção (mesmo formato de `schemaLeaves`). */
export function coveredLeaves(section: SectionConfig): string[] {
  const out: string[] = [];
  for (const field of sectionFields(section)) {
    switch (field.type) {
      case "link":
        out.push(`${field.path}.label`, `${field.path}.href`);
        break;
      case "seoPage":
        out.push(`${field.path}.title`, `${field.path}.description`);
        break;
      case "list":
        for (const item of field.items) out.push(`${field.path}[].${item.key}`);
        break;
      default:
        out.push(field.path);
    }
  }
  return out;
}
