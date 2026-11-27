/**
 * Conteúdo inicial das coleções do site (serviços e planos) segundo o briefing v2 — e o conteúdo do seed anterior
 * (v1), usado só para reconhecer registros que ninguém editou (ver ./upgrade-v2.ts).
 *
 * Só dados: usado por scripts/seed.ts (banco novo) e pela atualização idempotente (banco já criado).
 * Nada inventado: nomes e itens vêm do briefing v2 (seções 06 e 07). Onde o briefing não traz texto (resumo,
 * descrição, benefícios, perguntas), o campo nasce VAZIO e o bloco correspondente não aparece no site.
 */
import type { ServiceInterest } from "@/lib/domain";
import { SITE_PATHS } from "@/lib/site/paths";

export type SeedService = {
  slug: string;
  title: string;
  summary: string;
  items: string[];
  ctaLabel: string;
  interest: ServiceInterest;
  pagePath?: string;
};

const CTA = "Solicitar orçamento";

/** Briefing v2, seção 06 — as nove áreas, na ordem do documento. */
export const SERVICES_V2: SeedService[] = [
  {
    slug: "marketing-e-estrategia",
    title: "Marketing e estratégia",
    summary: "",
    items: ["Diagnóstico", "Planejamento", "Posicionamento", "Consultoria", "Campanhas"],
    ctaLabel: CTA,
    interest: "marketing",
  },
  {
    slug: "redes-sociais",
    title: "Redes sociais",
    summary: "",
    items: ["Calendário editorial", "Conteúdo", "Artes", "Legendas", "Agendamento", "Relatórios"],
    ctaLabel: CTA,
    interest: "redes_sociais",
  },
  {
    slug: "audiovisual",
    title: "Audiovisual",
    summary: "",
    items: ["Roteiros", "Reels", "Vídeos institucionais e publicitários", "Gravação", "Direção", "Edição", "Pós-produção"],
    ctaLabel: CTA,
    interest: "video",
  },
  {
    slug: "fotografia",
    title: "Fotografia",
    summary: "",
    items: ["Corporativa", "Ensaios", "Produtos", "Gastronomia", "Eventos", "Campanhas"],
    ctaLabel: CTA,
    interest: "fotografia",
  },
  {
    slug: "design-grafico",
    title: "Design gráfico",
    summary: "",
    items: ["Artes publicitárias e esportivas", "Manipulação de imagens", "Carrosséis", "Peças digitais e impressas"],
    ctaLabel: CTA,
    interest: "design",
  },
  {
    slug: "identidade-visual",
    title: "Identidade visual",
    summary: "",
    items: ["Logotipos", "Manual", "Direção criativa", "Posicionamento visual"],
    ctaLabel: CTA,
    interest: "identidade_visual",
  },
  {
    slug: "trafego-pago",
    title: "Tráfego pago",
    summary: "",
    items: ["Planejamento", "Configuração", "Gestão", "Otimização", "Relatórios"],
    ctaLabel: CTA,
    interest: "trafego",
  },
  {
    slug: "eventos-e-storymaker",
    title: "Eventos e storymaker",
    summary: "",
    items: ["Foto", "Filmagem", "Conteúdo em tempo real", "Melhores momentos"],
    ctaLabel: CTA,
    interest: "eventos",
    pagePath: SITE_PATHS.events,
  },
  {
    slug: "casamentos",
    title: "Casamentos",
    summary: "",
    items: ["Fotografia", "Filmes", "Pré-wedding", "Making of", "Teasers", "Galerias"],
    ctaLabel: CTA,
    interest: "casamentos",
    pagePath: SITE_PATHS.events,
  },
];

/** Seed anterior (v1) dos serviços + o slug do serviço v2 que o substitui. */
export const SERVICES_V1: (Omit<SeedService, "interest" | "pagePath"> & { becomes: string })[] = [
  {
    slug: "fotografia",
    title: "Fotografia",
    summary: "Ensaios, fotos para marcas e produtos, fotografia de eventos e cobertura social.",
    items: ["Ensaios individuais e profissionais", "Fotografia corporativa", "Fotografia de produtos", "Cobertura fotográfica de eventos", "Casamentos e pré-wedding"],
    ctaLabel: "Quero fotos",
    becomes: "fotografia",
  },
  {
    slug: "video",
    title: "Vídeo e produção audiovisual",
    summary: "Roteiro, captação, reels, vídeos institucionais, edição e pós-produção.",
    items: [
      "Vídeos institucionais",
      "Reels e vídeos para redes sociais",
      "Produção de campanhas",
      "Vídeos promocionais",
      "Captação e edição audiovisual",
      "Vídeos para profissionais e influenciadores",
    ],
    ctaLabel: "Quero vídeo",
    becomes: "audiovisual",
  },
  {
    slug: "marketing",
    title: "Marketing e redes sociais",
    summary: "Planejamento, calendário, gestão de conteúdo e acompanhamento de resultados.",
    items: [
      "Gestão de redes sociais",
      "Planejamento estratégico",
      "Calendário editorial",
      "Criação de conteúdos",
      "Roteiros e legendas",
      "Posicionamento e comunicação digital",
      "Acompanhamento de resultados",
    ],
    ctaLabel: "Quero presença digital",
    becomes: "marketing-e-estrategia",
  },
  {
    slug: "eventos",
    title: "Eventos",
    summary: "Foto, filme, storymaker e conteúdo em tempo real para eventos empresariais e sociais.",
    items: [
      "Cobertura fotográfica",
      "Filmagem profissional",
      "Storymaker",
      "Conteúdo em tempo real",
      "Vídeo de melhores momentos",
      "Cobertura para eventos empresariais e sociais",
    ],
    ctaLabel: "Quero cobrir meu evento",
    becomes: "eventos-e-storymaker",
  },
  {
    slug: "casamentos",
    title: "Casamentos",
    summary: "Pré-wedding, making of, fotografia e filme, com proposta específica para cada casal.",
    items: [
      "Fotografia do casamento",
      "Filme cinematográfico",
      "Making of dos noivos",
      "Ensaio pré-wedding",
      "Teaser vertical",
      "Filme de melhores momentos",
      "Galeria digital",
    ],
    ctaLabel: "Pedir proposta de casamento",
    becomes: "casamentos",
  },
];

// -------------------------------------------------------------------- planos
export type SeedPlan = {
  name: string;
  tagline: string;
  description: string;
  includes: string[];
  recommended?: boolean;
  /** Nome do plano em que este se apoia ("tudo do … mais"). */
  base?: string;
};

/**
 * Briefing v2, seção 07 — nomes provisórios e entregas descritas no documento. Sem preço nem quantidade.
 * "Integrado: acrescenta…" → o Integrado se apoia no Essencial. O briefing NÃO diz que o Estratégico inclui as
 * entregas do Integrado: ele entra só com a própria lista (os sócios definem o plano-base no painel, se for o caso).
 * Frase de posicionamento e descrição são as que os sócios já tinham aprovado para o nível equivalente (v1).
 */
export const PLANS_V2: SeedPlan[] = [
  {
    name: "Plano Essencial",
    tagline: "Para marcas que precisam começar a se comunicar com consistência.",
    description: "Foco em organizar a presença digital, criar conteúdo e estabelecer uma comunicação profissional.",
    includes: ["Planejamento mensal", "Calendário", "Design", "Legendas", "Padronização visual", "Reunião", "Relatório simplificado"],
  },
  {
    name: "Plano Integrado",
    tagline: "Para marcas que querem estar presentes de verdade.",
    description: "Foco em produção recorrente de conteúdo, planejamento de comunicação e fortalecimento do relacionamento com o público.",
    includes: ["Gestão de redes sociais", "Roteiros", "Captação", "Edição", "Reels", "Fotografias", "Agendamento", "Relatórios"],
    recommended: true,
    base: "Plano Essencial",
  },
  {
    name: "Plano Estratégico",
    tagline: "Para marcas que querem ampliar sua presença e desenvolver uma comunicação mais completa.",
    description: "Foco em maior volume de produção, acompanhamento estratégico e integração entre marketing e audiovisual.",
    includes: [
      "Estratégia integrada",
      "Produção recorrente",
      "Campanhas",
      "Direção criativa",
      "Peças publicitárias",
      "Acompanhamento",
      "Tráfego pago, quando contratado",
    ],
  },
];

/** Seed anterior (v1) dos planos, na mesma ordem de `PLANS_V2` (Começo → Essencial, Presença → Integrado…). */
export const PLANS_V1: { name: string; tagline: string; description: string }[] = [
  {
    name: "Começo",
    tagline: "Para marcas que precisam começar a se comunicar com consistência.",
    description: "Foco em organizar a presença digital, criar conteúdo e estabelecer uma comunicação profissional.",
  },
  {
    name: "Presença",
    tagline: "Para marcas que querem estar presentes de verdade.",
    description: "Foco em produção recorrente de conteúdo, planejamento de comunicação e fortalecimento do relacionamento com o público.",
  },
  {
    name: "Destaque",
    tagline: "Para marcas que querem ampliar sua presença e desenvolver uma comunicação mais completa.",
    description: "Foco em maior volume de produção, acompanhamento estratégico e integração entre marketing e audiovisual.",
  },
];

/**
 * Serviços avulsos. Os seis primeiros já existiam (v1); "Design" e "Campanhas pontuais" completam a lista do
 * briefing v2 ("diárias, edição, fotografia, design e campanhas pontuais").
 */
export const STANDALONE_V1 = ["Diária de fotógrafo", "Diária de filmmaker", "Cobertura de eventos", "Storymaker", "Produção e edição de vídeos", "Projetos personalizados"];
export const STANDALONE_ADDED_V2 = ["Design", "Campanhas pontuais"];

// -------------------------------------------------------- FAQ e aviso (v1 → v2)
export const FAQ_PLANS_V1 = {
  question: "Vocês trabalham com pacotes mensais?",
  answer: "Sim. Temos os planos Começo, Presença e Destaque, pensados para diferentes momentos de cada marca. As entregas de cada plano são definidas em proposta.",
};
export const FAQ_PLANS_V2 = {
  question: "Vocês trabalham com planos mensais?",
  answer:
    "Sim. Temos o Plano Essencial, o Plano Integrado e o Plano Estratégico, pensados para diferentes momentos de cada marca. As entregas de cada plano são definidas em proposta.",
};
/** Link do aviso de casamentos do seed (a rota mudou). */
export const OLD_WEDDINGS_PATH = "/casamentos";
