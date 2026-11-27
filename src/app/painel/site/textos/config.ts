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
  { href: "/sobre", label: "Sobre a NÓS" },
  { href: "/servicos", label: "Serviços" },
  { href: "/planos", label: "Planos" },
  { href: "/planos#planos-avulsos", label: "Serviços avulsos" },
  { href: "/eventos-e-casamentos", label: "Eventos e Casamentos" },
  { href: "/eventos-e-casamentos#eventos-formulario", label: "Formulário de eventos" },
  { href: "/portfolio", label: "Portfólio" },
  { href: "/contato", label: "Contato e orçamento" },
  { href: "/contato#formulario", label: "Formulário de contato" },
  { href: "/privacidade", label: "Política de privacidade" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/cookies", label: "Política de cookies" },
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
          text("serviceArea", "Cidade ou região atendida", "É a “localização” do rodapé. Ex.: “Atendemos toda a região metropolitana de Curitiba”. Vazio = não aparece no site."),
        ],
      },
      {
        id: "direitos",
        title: "Direitos autorais",
        fields: [text("copyright", "Linha de direitos autorais", "Aparece no rodapé, depois de “© ano” e do nome da marca.")],
      },
    ],
  },

  // ----------------------------------------------------------- navegação
  navigation: {
    key: "navigation",
    title: SITE_CONTENT_LABELS.navigation,
    summary: "Nomes dos itens do menu, o link da Área do Cliente e o botão de destaque do topo.",
    publicPath: "/",
    notice: {
      tone: "info",
      title: "O menu se ajusta sozinho",
      text: "Planos só aparece com planos publicados; Portfólio, só com projetos publicados; Eventos e Casamentos segue a chave em “Páginas visíveis”. Apagar o nome de um item também o tira do menu e do rodapé.",
    },
    groups: [
      {
        id: "itens",
        title: "Itens do menu",
        description: "Na ordem em que aparecem no topo e no rodapé do site.",
        fields: [
          text("home", "Início"),
          text("about", "Sobre a NÓS"),
          text("services", "Serviços"),
          text("plans", "Planos"),
          text("portfolio", "Portfólio"),
          text("events", "Eventos e Casamentos"),
          text("contact", "Contato"),
        ],
      },
      {
        id: "acesso",
        title: "Área do Cliente e botão de destaque",
        fields: [
          text("clientArea", "Área do Cliente", "Link para a tela de login (clientes, equipe e painel entram por ali). Vazio = o link some do site."),
          link("cta", "Botão de destaque do topo", "O botão lima do cabeçalho. Texto vazio = o botão some."),
        ],
      },
    ],
  },

  // ------------------------------------------------------- visibilidade
  visibility: {
    key: "visibility",
    title: SITE_CONTENT_LABELS.visibility,
    summary: "Liga e desliga páginas inteiras e recursos do site.",
    publicPath: "/",
    notice: {
      tone: "info",
      title: "Blocos vazios não aparecem",
      text: "Mesmo com a chave ligada, um bloco sem conteúdo publicado não aparece no site (nem o título, nem o link do menu). Por exemplo: o Portfólio só surge quando houver pelo menos um projeto publicado. Para mudar a ordem ou esconder um bloco só da página inicial, use Editar site → Página inicial.",
    },
    groups: [
      {
        id: "paginas",
        title: "Páginas e itens do menu",
        description: "Desligar uma página a tira do menu, da página inicial e do mapa do site.",
        fields: [
          toggle("portfolio", "Portfólio", "Página /portfolio, item no menu e bloco na página inicial. Começa desligado: ligue quando houver projetos reais e autorizados."),
          toggle("packages", "Planos", "Página /planos, item no menu e os blocos de planos e de serviços avulsos na página inicial."),
          toggle("weddings", "Eventos e Casamentos", "Página /eventos-e-casamentos, item no menu e bloco na página inicial."),
        ],
      },
      {
        id: "blocos",
        title: "Conteúdos que aparecem em mais de uma página",
        fields: [
          toggle("testimonials", "Depoimentos", "O que os clientes dizem (página inicial e Eventos e Casamentos). Só aparece com depoimentos publicados e autorizados pelo cliente."),
          toggle("faq", "Perguntas frequentes", "Dúvidas comuns (página inicial e Eventos e Casamentos). Só aparecem as perguntas publicadas."),
        ],
      },
      {
        id: "whatsapp",
        title: "WhatsApp",
        fields: [
          toggle("whatsappFloat", "Botão flutuante de WhatsApp", "Botão fixo no canto da tela, no celular. Só aparece se o número do WhatsApp estiver cadastrado em “Contato e redes”."),
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- home
  home: {
    key: "home",
    title: SITE_CONTENT_LABELS.home,
    summary: "Os textos de cada bloco da página inicial: topo, serviços, fundadores, planos, eventos e fechamento.",
    publicPath: "/",
    notice: { tone: "info", text: "A ordem dos blocos e quais aparecem são definidos em Editar site → Página inicial. Os diferenciais e o processo de atendimento têm telas próprias em Textos." },
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
        title: "Serviços",
        description: "A lista mostra os serviços publicados em Editar site → Serviços, na ordem de lá. Aqui ficam só os textos do bloco.",
        fields: within("highlights", [eyebrow(), text("title", "Título do bloco"), area("text", "Texto do bloco", "Opcional."), link("cta", "Botão do bloco")]),
      },
      {
        id: "fundadores",
        title: "Fundadores",
        description: "Apresentação de Pedro Henrique e Laura na página inicial. Fotos e bios ficam em Sobre a NÓS.",
        fields: within("founders", [
          eyebrow(),
          text("title", "Título do bloco"),
          md("text", "Texto de apresentação", "Parágrafos separados por uma linha em branco.", 8),
          link("cta", "Botão do bloco"),
        ]),
      },
      {
        id: "pacotes",
        title: "Planos",
        description: "Aparece com “Planos” ligado em Páginas visíveis e planos publicados. Os planos em si ficam em Editar site → Planos.",
        fields: within("packages", [eyebrow(), text("title", "Título do bloco"), area("text", "Texto do bloco", "Opcional."), link("cta", "Botão do bloco")]),
      },
      {
        id: "avulsos",
        title: "Serviços avulsos",
        description: "Lista dos serviços avulsos publicados em Editar site → Planos.",
        fields: within("standalone", [eyebrow(), text("title", "Título do bloco"), area("text", "Texto do bloco", "Opcional."), link("cta", "Botão do bloco")]),
      },
      {
        id: "eventos",
        title: "Eventos e casamentos",
        description: "Chamada para a página de Eventos e Casamentos. Os dois painéis usam os títulos cadastrados naquela página.",
        fields: within("events", [
          eyebrow(),
          text("title", "Chamada", "Para destacar um trecho, coloque-o entre asteriscos: histórias que *permanecem.*"),
          area("text", "Texto do bloco", "Opcional."),
          link("cta", "Botão do bloco"),
        ]),
      },
      {
        id: "portfolio",
        title: "Portfólio em destaque",
        description: "Aparece se o Portfólio estiver ligado em Páginas visíveis e houver projetos publicados.",
        fields: within("portfolio", [
          eyebrow(),
          text("title", "Título do bloco"),
          area("text", "Texto do bloco", "Opcional."),
          link("cta", "Botão do bloco"),
        ]),
      },
      {
        id: "depoimentos",
        title: "Clientes e depoimentos",
        description: "Aparece se Depoimentos estiver ligado em Páginas visíveis e houver depoimentos publicados.",
        fields: within("testimonials", [eyebrow(), text("title", "Título do bloco")]),
      },
      {
        id: "faq",
        title: "Perguntas frequentes",
        description: "Aparece se Perguntas frequentes estiver ligado em Páginas visíveis e houver perguntas publicadas para a página inicial.",
        fields: within("faq", [eyebrow(), text("title", "Título do bloco"), link("cta", "Botão do bloco")]),
      },
      {
        id: "fechamento",
        title: "Fechamento",
        description: "Chamada final com o formulário de contato.",
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
    summary: "História da NÓS, fotos e bios de Pedro Henrique e Laura, missão, visão e valores.",
    publicPath: "/sobre",
    notice: {
      tone: "alerta",
      title: "Validem as biografias antes de divulgar o site",
      text: "A abertura, as bios e a missão, visão e valores vieram do briefing de novembro de 2026. Confiram datas, cargos e experiências de cada um antes de publicar. Os blocos “Por que nasceu a NÓS”, “Manifesto” e “Essência” estão vazios (não aparecem no site) e podem ser preenchidos quando quiserem.",
    },
    groups: [
      {
        id: "abertura",
        title: "Abertura",
        description: "Topo da página Sobre a NÓS.",
        fields: [
          eyebrow(),
          text("title", "Título da página", undefined, { required: true }),
          md("intro", "Texto de abertura", "Parágrafos separados por uma linha em branco. Dá para usar **negrito** e listas.", 10),
          image("coupleMediaId", "Foto dos dois juntos", "Foto de Pedro e Laura juntos. Aparece na abertura da página.", "4/5"),
        ],
      },
      {
        id: "fundadores",
        title: "Fundadores",
        description: "Cada pessoa tem foto, resumo (usado em “Quem estará no dia”, na página de Eventos e Casamentos) e bio completa (usada nesta página).",
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
              { key: "shortBio", type: "textarea", label: "Resumo (Eventos e Casamentos)" },
              { key: "bio", type: "markdown", label: "Bio completa (esta página)" },
            ],
          },
        ],
      },
      {
        id: "porque",
        title: "Por que nasceu a NÓS",
        description: "Opcional. Vazio = o bloco não aparece.",
        fields: within("why", [text("title", "Título"), md("text", "Texto", "Parágrafos separados por uma linha em branco.", 10)]),
      },
      {
        id: "manifesto",
        title: "Manifesto",
        description: "Trecho em destaque da página. Opcional: vazio = o bloco não aparece.",
        fields: within("manifesto", [md("text", "Texto do manifesto", undefined, 8), text("closing", "Frase final")]),
      },
      {
        id: "missao",
        title: "Missão e visão",
        description: "Aparecem em destaque, no mesmo bloco dos valores.",
        fields: [
          text("mission.title", "Nome do primeiro bloco"),
          area("mission.text", "Missão", undefined, 3),
          text("vision.title", "Nome do segundo bloco"),
          area("vision.text", "Visão", undefined, 3),
        ],
      },
      {
        id: "valores",
        title: "Valores",
        fields: within("values", [
          eyebrow("Rótulo do bloco de missão, visão e valores."),
          text("title", "Título da lista de valores"),
          {
            type: "list",
            path: "items",
            label: "Valores",
            hint: "Até 8. Cada um tem um título; a frase é opcional.",
            itemName: "valor",
            addLabel: "Adicionar valor",
            items: titledItems,
          },
        ]),
      },
      {
        id: "essencia",
        title: "Essência",
        description: "Fecho da página. Opcional: vazio = entra a chamada padrão para o contato.",
        fields: within("essence", [
          text("title", "Título"),
          md("text", "Texto", "Use **negrito** para destacar trechos.", 8),
          text("signature", "Assinatura"),
        ]),
      },
    ],
  },

  // -------------------------------------------------------- differentials
  differentials: {
    key: "differentials",
    title: SITE_CONTENT_LABELS.differentials,
    summary: "Os diferenciais da NÓS, mostrados na página inicial.",
    publicPath: "/#diferenciais",
    notice: { tone: "info", text: "O briefing trouxe só os títulos dos seis diferenciais. Se quiserem, escrevam uma frase curta para cada um: ela aparece logo abaixo do título." },
    groups: [
      {
        id: "bloco",
        title: "Bloco “Diferenciais”",
        fields: [
          eyebrow(),
          text("title", "Título do bloco"),
          {
            type: "list",
            path: "items",
            label: "Diferenciais",
            hint: "Até 8. O título é obrigatório; a frase é opcional.",
            itemName: "diferencial",
            addLabel: "Adicionar diferencial",
            items: titledItems,
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------- howItWorks
  howItWorks: {
    key: "howItWorks",
    title: SITE_CONTENT_LABELS.howItWorks,
    summary: "As etapas do atendimento: conexão, estratégia, planejamento, produção e entrega.",
    publicPath: "/#como-funciona",
    notice: { tone: "info", text: "O briefing trouxe só os nomes das cinco etapas. Se quiserem, escrevam uma frase curta para cada uma: ela aparece ao lado do nome." },
    groups: [
      {
        id: "bloco",
        title: "Bloco “Processo de atendimento”",
        description: "Aparece na página inicial, na página de Serviços e, resumido, ao lado do formulário de contato.",
        fields: [
          eyebrow(),
          text("title", "Título do bloco"),
          {
            type: "list",
            path: "steps",
            label: "Etapas",
            hint: "Até 8 etapas, na ordem em que acontecem. A frase de cada etapa é opcional.",
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
    summary: "Textos da página de serviços e os títulos dos blocos da página de cada serviço.",
    publicPath: "/servicos",
    notice: { tone: "info", text: "Os serviços em si (nome, descrição, entregas, benefícios, perguntas e fotos) são editados em Editar site → Serviços." },
    groups: [
      {
        id: "topo",
        title: "Topo da página",
        fields: [
          eyebrow(),
          text("title", "Título da página", undefined, { required: true }),
          area("intro", "Texto de abertura", undefined, 3),
          text("detailLabel", "Texto do link de cada serviço", "Leva à página própria do serviço. Ex.: “Ver o serviço”."),
        ],
      },
      {
        id: "fechamento",
        title: "Fechamento",
        description: "Faixa no fim da página, depois da lista de serviços.",
        fields: [text("closingTitle", "Título"), area("closingText", "Texto"), link("cta", "Botão")],
      },
      {
        id: "detalhe",
        title: "Página de cada serviço",
        description: "Títulos dos blocos de /servicos/nome-do-servico. Bloco sem conteúdo cadastrado não aparece.",
        fields: within("detail", [
          text("deliverablesTitle", "Título de “possíveis entregas”"),
          text("benefitsTitle", "Título de “benefícios”"),
          text("mediaTitle", "Título do vídeo e da galeria"),
          text("relatedTitle", "Título de “trabalhos relacionados”"),
          text("faqTitle", "Título das perguntas frequentes"),
          text("quoteTitle", "Chamada do orçamento", "Fica ao lado do formulário, no fim da página."),
          area("quoteText", "Texto do orçamento"),
          text("othersTitle", "Título de “outros serviços”"),
          text("pageLinkLabel", "Botão da página temática", "Só aparece em serviços que têm uma página temática (ex.: Casamentos → Eventos e Casamentos)."),
        ]),
      },
    ],
  },

  // --------------------------------------------------------- packagesPage
  packagesPage: {
    key: "packagesPage",
    title: SITE_CONTENT_LABELS.packagesPage,
    summary: "Textos da página de planos e serviços avulsos. Valores e entregas ficam em Editar site → Planos.",
    publicPath: "/planos",
    notice: {
      tone: "alerta",
      title: "Nomes dos planos, entregas e valores ainda são provisórios",
      text: "O briefing pede para não publicar preços nem quantidades antes de validar custos, capacidade e margem. Enquanto um plano não tiver valor publicado, o site mostra o texto de “Texto no lugar do valor”. Os planos em si (nome, entregas, opcionais, valor, destaque) são editados em Editar site → Planos.",
    },
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
          text("recommendedLabel", "Etiqueta do plano em destaque", "Selo que aparece no plano marcado como destaque."),
          text("priceOnRequestLabel", "Texto no lugar do valor", "Aparece em cada plano que ainda não tem valor publicado. Vazio = a linha de investimento some."),
          area("note", "Aviso sob os planos", "Explica que entregas, quantidades e investimento são definidos em proposta."),
        ],
      },
      {
        id: "comparativo",
        title: "Tabela comparativa",
        description: "Montada sozinha a partir do campo “O que inclui” de cada plano (um plano com plano-base herda as entregas dele).",
        fields: within("comparison", [
          toggle("enabled", "Mostrar a tabela comparativa", "Só aparece com dois ou mais planos publicados que tenham entregas cadastradas."),
          text("title", "Título da tabela"),
          area("intro", "Texto ao lado do título", "Opcional."),
        ]),
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
    summary: "Página de Eventos e Casamentos: eventos corporativos e sociais, casamentos, formatos de cobertura e formulário de data.",
    publicPath: "/eventos-e-casamentos",
    notice: {
      tone: "info",
      title: "O formulário não reserva data",
      text: "Quem envia o formulário desta página vira um lead no painel (Leads), com tipo, data, horário, local, convidados e serviços. Nada entra na agenda sozinho: a confirmação é sempre de vocês. Galeria e depoimentos só aparecem quando houver projetos e relatos reais publicados.",
    },
    groups: [
      {
        id: "topo",
        title: "Topo da página",
        fields: [
          eyebrow(),
          text("title", "Chamada da página", "Com duas frases, cada uma começa na sua linha. Para destacar um trecho, coloque-o entre asteriscos: histórias que *permanecem.*", { required: true }),
          area("lead", "Frase de apoio"),
          text("ctaLabel", "Botão que leva ao formulário"),
          image("heroMediaId", "Foto do topo", "Opcional. Uma foto real e autorizada de evento ou casamento. Prefira horizontal.", "16/9"),
        ],
      },
      {
        id: "eventos",
        title: "Eventos corporativos e sociais",
        fields: within("events", [
          eyebrow("Rótulo da primeira parte da página."),
          text("title", "Título"),
          md("text", "Texto", "Parágrafos separados por uma linha em branco.", 5),
          {
            type: "list",
            path: "items",
            label: "Formatos de cobertura",
            hint: "Até 12. O título é obrigatório; a frase é opcional.",
            itemName: "formato",
            addLabel: "Adicionar formato",
            items: titledItems,
          },
        ]),
      },
      {
        id: "abordagem",
        title: "Casamentos — nosso olhar",
        fields: [
          text("weddingsEyebrow", "Rótulo da segunda parte da página", "Também é o nome do painel de casamentos na página inicial."),
          text("approach.title", "Título"),
          md("approach.text", "Texto", "Parágrafos separados por uma linha em branco.", 8),
        ],
      },
      {
        id: "cobertura",
        title: "Casamentos — o que a cobertura pode incluir",
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
        id: "galeria",
        title: "Galeria",
        description: "Mostra os projetos de Eventos e de Casamentos publicados no Portfólio. Sem projetos publicados, o bloco não aparece.",
        fields: [text("galleryTitle", "Título do bloco")],
      },
      {
        id: "formulario",
        title: "Formulário de disponibilidade",
        fields: within("form", [
          text("title", "Título"),
          area("text", "Texto"),
          text("submitLabel", "Texto do botão de enviar"),
          area("note", "Aviso sobre a data", "Deixa claro que o envio não reserva a data nem confirma a contratação."),
        ]),
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
      {
        id: "grade",
        title: "Grade, pesquisa e filtros",
        description: "Os nomes das categorias dos filtros são fixos; só aparecem as categorias que têm projeto publicado.",
        fields: [
          text("projectsLabel", "Rótulo da seção de projetos"),
          text("searchLabel", "Nome do campo de pesquisa", "Lido por leitores de tela e mostrado acima do campo."),
          text("searchPlaceholder", "Exemplo dentro do campo de pesquisa"),
          text("allLabel", "Filtro que mostra todas as categorias"),
          text("featuredLabel", "Selo dos projetos em destaque"),
          text("noResultsTitle", "Título quando a pesquisa não encontra nada"),
          area("noResultsText", "Texto quando a pesquisa não encontra nada"),
          text("clearLabel", "Botão que limpa a pesquisa e os filtros"),
        ],
      },
      {
        id: "projeto",
        title: "Página de cada projeto",
        description: "Títulos dos blocos de /portfolio/nome-do-projeto. Bloco sem conteúdo cadastrado não aparece.",
        fields: within("detail", [
          text("backLabel", "Link de volta para o portfólio"),
          text("aboutTitle", "Rótulo do bloco de apresentação", "Cliente, categoria, data, serviços e descrição."),
          text("caseTitle", "Rótulo do estudo de caso", "Reúne objetivo, desafio, solução e resultados."),
          text("objectiveTitle", "Título de “objetivo”"),
          text("challengeTitle", "Título de “desafio”"),
          text("solutionTitle", "Título de “solução”"),
          text("resultsTitle", "Título de “resultados”"),
          text("videoTitle", "Título dos vídeos"),
          text("galleryTitle", "Título da galeria"),
          text("beforeAfterTitle", "Título de “antes e depois”"),
          text("beforeLabel", "Etiqueta da imagem de antes"),
          text("afterLabel", "Etiqueta da imagem de depois"),
          text("backstageTitle", "Título dos bastidores"),
          text("relatedTitle", "Título dos projetos relacionados"),
          text("shareTitle", "Título do compartilhamento"),
          text("previousTitle", "Aviso de experiência anterior: título", "Aparece nos projetos marcados como experiência anterior dos fundadores."),
          area("previousText", "Aviso de experiência anterior: texto", "A observação escrita em cada projeto aparece logo depois deste texto."),
        ]),
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

  // ----------------------------------------------------------- termsPage
  termsPage: {
    key: "termsPage",
    title: SITE_CONTENT_LABELS.termsPage,
    summary: "Texto dos termos de uso do site e versão.",
    publicPath: "/termos",
    notice: {
      tone: "alerta",
      title: "Texto-base sugerido: precisa de revisão jurídica",
      text: "Este texto foi escrito como ponto de partida e não traz dados da empresa (razão social, CNPJ, endereço, foro). Antes de divulgar o site, peçam a um advogado ou assessoria jurídica para revisar e completar. Os marcadores {{marca}} e {{email}} são preenchidos automaticamente.",
    },
    groups: [
      {
        id: "termos",
        title: "Termos de uso",
        fields: [
          text("title", "Título da página", "Também é o nome do link no rodapé.", { required: true }),
          text("version", "Versão ou data", "Aparece no topo da página. Mude sempre que alterar o texto (ex.: 2026-11).", { required: true }),
          md("body", "Texto dos termos", "Use ## para títulos de seção, - para listas e **negrito**. {{marca}} e {{email}} são preenchidos automaticamente.", 24, { required: true }),
        ],
      },
    ],
  },

  // --------------------------------------------------------- cookiesPage
  cookiesPage: {
    key: "cookiesPage",
    title: SITE_CONTENT_LABELS.cookiesPage,
    summary: "Texto da política de cookies e versão.",
    publicPath: "/cookies",
    notice: {
      tone: "alerta",
      title: "Texto-base sugerido: precisa de revisão jurídica",
      text: "O texto descreve o que o site usa hoje: nenhum cookie de rastreamento no site público e só os cookies essenciais do login nas áreas privadas — por isso não há aviso de consentimento de cookies. A contagem de visitas é do próprio site e não usa cookies (está descrita no texto). Se um dia forem ligadas estatísticas de terceiros ou publicidade (Google Analytics, Meta Pixel…), este texto e o site precisam mudar antes. Peçam a revisão de um advogado ou assessoria jurídica.",
    },
    groups: [
      {
        id: "cookies",
        title: "Política de cookies",
        fields: [
          text("title", "Título da página", "Também é o nome do link no rodapé.", { required: true }),
          text("version", "Versão ou data", "Aparece no topo da página. Mude sempre que alterar o texto (ex.: 2026-11).", { required: true }),
          md("body", "Texto da política", "Use ## para títulos de seção, - para listas e **negrito**. {{marca}} e {{email}} são preenchidos automaticamente.", 24, { required: true }),
        ],
      },
    ],
  },

  // -------------------------------------------------------- visitCounter
  visitCounter: {
    key: "visitCounter",
    title: SITE_CONTENT_LABELS.visitCounter,
    summary: "Liga o contador público de visitas (acima do rodapé) e define a frase e a legenda.",
    publicPath: "/#contador-de-visitas",
    notice: {
      tone: "info",
      title: "O número é real e não pode ser digitado",
      text: "O contador mostra o total de visitas medido pelo próprio site desde que a contagem começou (veja Editar site → Métricas). Ele nasce desligado: ligue quando quiser mostrar. O número do site é atualizado a cada poucos minutos, e visitas de robôs e de quem está logado no painel não entram na conta.",
    },
    groups: [
      {
        id: "exibicao",
        title: "Exibição",
        fields: [
          toggle("enabled", "Mostrar o contador no site", "Aparece no fim de todas as páginas, logo acima do rodapé. Sem nenhuma visita medida, ele não aparece mesmo ligado."),
          text("minimum", "Só mostrar a partir de quantas visitas", "Opcional, só números (ex.: 500). Enquanto o total for menor, o contador fica oculto. Vazio = mostra desde a primeira visita."),
        ],
      },
      {
        id: "textos",
        title: "Textos",
        fields: [
          text("phrase", "Frase", "Aparece ao lado do número."),
          text(
            "label",
            "Legenda do número",
            "Diz o que o número conta. {{inicio}} é trocado pelo mês em que a contagem começou (ex.: “novembro de 2026”). Sem legenda, o contador não aparece.",
          ),
        ],
      },
    ],
  },

  // -------------------------------------------------------- notFoundPage
  notFoundPage: {
    key: "notFoundPage",
    title: SITE_CONTENT_LABELS.notFoundPage,
    summary: "O que aparece quando alguém abre um endereço que não existe.",
    publicPath: "/pagina-que-nao-existe",
    groups: [
      {
        id: "pagina",
        title: "Página não encontrada",
        fields: [eyebrow("Pequeno rótulo acima do título."), text("title", "Título", undefined, { required: true }), text("text", "Frase de apoio"), link("cta", "Botão")],
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
        description: "É o que aparece como resultado de busca no Google. Mantenha o título curto e a descrição clara. A página de cada serviço usa o nome e o resumo do próprio serviço.",
        fields: [
          { type: "seoPage", path: "pages.home", label: "Página inicial", publicPath: "/", required: true },
          { type: "seoPage", path: "pages.sobre", label: "Sobre a NÓS", publicPath: "/sobre", required: true },
          { type: "seoPage", path: "pages.servicos", label: "Serviços", publicPath: "/servicos", required: true },
          { type: "seoPage", path: "pages.pacotes", label: "Planos", publicPath: "/planos", required: true },
          { type: "seoPage", path: "pages.casamentos", label: "Eventos e Casamentos", publicPath: "/eventos-e-casamentos", required: true },
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
  "navigation",
  "visibility",
  "home",
  "differentials",
  "howItWorks",
  "about",
  "servicesPage",
  "packagesPage",
  "weddingsPage",
  "portfolioPage",
  "contactPage",
  "privacyPage",
  "termsPage",
  "cookiesPage",
  "visitCounter",
  "notFoundPage",
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
