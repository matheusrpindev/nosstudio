/**
 * Ordem e visibilidade das seções da página inicial (briefing v2, seção 03: "permitir reorganizar e ocultar
 * seções"). Guardado na tabela `site_content` com a chave `homeLayout` e editado em Editar site › Página inicial.
 *
 * Arquivo puro (sem banco): leitura pública em `getHomeLayout()` (src/server/site/queries.ts); gravação em
 * src/server/site/home-layout.ts. A lógica (ordem padrão, mesclar o que foi salvo, mover, ligar/desligar) é
 * testada em home-layout.test.ts.
 *
 * O topo (hero — onde entra o carrossel de banners na próxima etapa) e o rodapé NÃO estão aqui: são fixos.
 * Seção nova: acrescente o id em `HOME_SECTION_IDS` na posição padrão, o rótulo abaixo e o bloco em
 * src/app/(site)/page.tsx — bancos que já salvaram uma ordem recebem a seção nova depois da vizinha anterior.
 */
import "@/lib/zod-setup";
import { z } from "zod";

/** Ordem padrão = ordem do briefing. */
export const HOME_SECTION_IDS = [
  "servicos",
  "portfolio",
  "diferenciais",
  "fundadores",
  "processo",
  "planos",
  "avulsos",
  "eventos",
  "depoimentos",
  "faq",
  "formulario",
] as const;
export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export const HOME_LAYOUT_KEY = "homeLayout";

export type HomeSectionState = { id: HomeSectionId; visible: boolean };
export type HomeLayout = HomeSectionState[];

/** Rótulo e explicação de cada seção (para o painel). `editHref`: onde se edita o conteúdo dela. */
export const HOME_SECTION_INFO: Record<HomeSectionId, { label: string; description: string; editHref: string }> = {
  servicos: {
    label: "Serviços",
    description: "Lista dos serviços publicados, com link para a página de cada um.",
    editHref: "/painel/site/servicos",
  },
  portfolio: {
    label: "Portfólio em destaque",
    description: "Até três projetos publicados. Só aparece com o Portfólio ligado e projetos publicados.",
    editHref: "/painel/site/portfolio",
  },
  diferenciais: {
    label: "Diferenciais",
    description: "Os diferenciais da NÓS.",
    editHref: "/painel/site/textos/differentials",
  },
  fundadores: {
    label: "Fundadores",
    description: "Apresentação de Pedro Henrique e Laura, com as fotos.",
    editHref: "/painel/site/textos/home#bloco-fundadores",
  },
  processo: {
    label: "Processo de atendimento",
    description: "As etapas, da conexão à entrega.",
    editHref: "/painel/site/textos/howItWorks",
  },
  planos: {
    label: "Planos",
    description: "Os planos mensais publicados.",
    editHref: "/painel/site/pacotes",
  },
  avulsos: {
    label: "Serviços avulsos",
    description: "Os serviços avulsos publicados.",
    editHref: "/painel/site/pacotes",
  },
  eventos: {
    label: "Eventos e casamentos",
    description: "Chamada para a página de Eventos e Casamentos.",
    editHref: "/painel/site/textos/home#bloco-eventos",
  },
  depoimentos: {
    label: "Clientes e depoimentos",
    description: "Só aparece com Depoimentos ligado e depoimentos publicados e autorizados.",
    editHref: "/painel/site/depoimentos",
  },
  faq: {
    label: "Perguntas frequentes",
    description: "Só aparecem as perguntas publicadas e marcadas para a página inicial.",
    editHref: "/painel/site/faq",
  },
  formulario: {
    label: "Formulário de contato",
    description: "Chamada final com o formulário e os canais de contato.",
    editHref: "/painel/site/textos/home#bloco-fechamento",
  },
};

export const defaultHomeLayout: HomeLayout = HOME_SECTION_IDS.map((id) => ({ id, visible: true }));

const storedSchema = z.array(z.object({ id: z.string(), visible: z.boolean() })).max(60);
const isSectionId = (value: string): value is HomeSectionId => (HOME_SECTION_IDS as readonly string[]).includes(value);

/**
 * Valor salvo (possivelmente antigo, incompleto ou corrompido) → lista válida com TODAS as seções, uma vez cada.
 * - ids desconhecidos (seção removida do código) e repetidos são descartados;
 * - seções que não existiam quando a ordem foi salva entram logo depois da vizinha anterior da ordem padrão
 *   (ou no início, se nenhuma anterior existir), visíveis.
 */
export function resolveHomeLayout(stored: unknown): HomeLayout {
  const parsed = storedSchema.safeParse(stored);
  if (!parsed.success) return defaultHomeLayout.map((item) => ({ ...item }));

  const result: HomeLayout = [];
  for (const item of parsed.data) {
    if (!isSectionId(item.id) || result.some((existing) => existing.id === item.id)) continue;
    result.push({ id: item.id, visible: item.visible });
  }
  HOME_SECTION_IDS.forEach((id, index) => {
    if (result.some((item) => item.id === id)) return;
    const previous = HOME_SECTION_IDS.slice(0, index)
      .reverse()
      .find((candidate) => result.some((item) => item.id === candidate));
    const at = previous ? result.findIndex((item) => item.id === previous) + 1 : 0;
    result.splice(at, 0, { id, visible: true });
  });
  return result;
}

/** Troca a seção de lugar com a vizinha. Devolve a MESMA lista se já estiver na ponta ou o id não existir. */
export function moveHomeSection(layout: HomeLayout, id: HomeSectionId, direction: "up" | "down"): HomeLayout {
  const from = layout.findIndex((item) => item.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= layout.length) return layout;
  const next = layout.map((item) => ({ ...item }));
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Liga ou desliga uma seção. */
export function setHomeSectionVisible(layout: HomeLayout, id: HomeSectionId, visible: boolean): HomeLayout {
  return layout.map((item) => (item.id === id ? { ...item, visible } : { ...item }));
}

/** Coloca as seções na ordem dada (arrastar e soltar). Ids que faltarem mantêm a posição relativa no fim. */
export function reorderHomeSections(layout: HomeLayout, order: readonly string[]): HomeLayout {
  const byId = new Map(layout.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const next: HomeLayout = [];
  for (const id of order) {
    const item = isSectionId(id) ? byId.get(id) : undefined;
    if (!item || seen.has(id)) continue;
    seen.add(id);
    next.push({ ...item });
  }
  for (const item of layout) if (!seen.has(item.id)) next.push({ ...item });
  return next;
}

/** Ids das seções ligadas, na ordem de exibição. */
export function visibleHomeSections(layout: HomeLayout): HomeSectionId[] {
  return layout.filter((item) => item.visible).map((item) => item.id);
}

/** A ordem e a visibilidade são as padrão (nada foi mudado)? */
export function isDefaultHomeLayout(layout: HomeLayout): boolean {
  return layout.length === defaultHomeLayout.length && layout.every((item, i) => item.id === defaultHomeLayout[i].id && item.visible);
}

export function isHomeSectionId(value: unknown): value is HomeSectionId {
  return typeof value === "string" && isSectionId(value);
}
