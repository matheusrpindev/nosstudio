/**
 * Banners iniciais do carrossel (briefing v2, seção 04) — textos dos sócios: título / subtítulo / botão.
 *
 * Entram UMA vez em cada banco, novo ou já criado (roda no `npm run db:seed`): depois da primeira execução fica
 * a marca `INITIAL_BANNERS_MARK` na tabela `settings`, e daí em diante nada é recriado — se os sócios apagarem
 * ou editarem os banners, eles não voltam. Se o banco já tiver algum banner (criado no painel antes desta
 * versão), nada é inserido e a marca é gravada do mesmo jeito.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { banners, settings } from "@/db/schema";
import type { BrandColor } from "@/lib/domain";
import { SITE_PATHS, servicePath, FORM_ANCHORS } from "@/lib/site/paths";

/** Chave da marca em `settings` (não é uma configuração editável: só registra que os banners já foram criados). */
export const INITIAL_BANNERS_MARK = "seed:initialBanners";

type InitialBanner = { name: string; title: string; subtitle: string; buttonLabel: string; buttonUrl: string; bgColor: BrandColor };

/**
 * Só texto (os sócios ainda não têm fotos): cada cor de fundo traz uma composição da marca diferente.
 * Destinos dos botões — decididos aqui, o briefing só dá o rótulo:
 * - "Conheça a NÓS" → Sobre a NÓS;
 * - "Conheça nossas produções" → a página do serviço de Audiovisual;
 * - "Explore nosso portfólio" → Portfólio (enquanto ele estiver oculto, o site leva a Serviços — ver
 *   `resolveBannerHref` em src/lib/site/banners.ts);
 * - "Consulte nossa agenda" → o formulário de Eventos e Casamentos (um pedido de proposta; não promete data).
 */
export const INITIAL_BANNERS: readonly InitialBanner[] = [
  {
    name: "Abertura — Sua história, nosso olhar",
    title: "Sua história, nosso olhar.",
    subtitle: "Marketing, comunicação e audiovisual em um só lugar",
    buttonLabel: "Conheça a NÓS",
    buttonUrl: SITE_PATHS.about,
    bgColor: "roxo",
  },
  {
    name: "Audiovisual — Não apenas vídeos",
    title: "Não apenas vídeos. Histórias.",
    subtitle: "Produções que traduzem a essência da sua marca",
    buttonLabel: "Conheça nossas produções",
    buttonUrl: servicePath("audiovisual"),
    bgColor: "grafite",
  },
  {
    name: "Design — O comum não é nosso estilo",
    title: "O comum não é nosso estilo.",
    subtitle: "Design, identidade e criatividade com personalidade",
    buttonLabel: "Explore nosso portfólio",
    buttonUrl: SITE_PATHS.portfolio,
    bgColor: "lima",
  },
  {
    name: "Eventos — Momentos passam",
    title: "Momentos passam. Histórias ficam.",
    subtitle: "Fotografia e audiovisual para momentos especiais",
    buttonLabel: "Consulte nossa agenda",
    buttonUrl: `${SITE_PATHS.events}#${FORM_ANCHORS.events}`,
    bgColor: "lavanda",
  },
];

/** Cria os banners iniciais se este banco ainda não passou por aqui. Devolve quantos foram criados. */
export async function ensureInitialBanners(): Promise<number> {
  return db.transaction(async (tx) => {
    const [mark] = await tx.select({ key: settings.key }).from(settings).where(eq(settings.key, INITIAL_BANNERS_MARK));
    if (mark) return 0;
    const [existing] = await tx.select({ id: banners.id }).from(banners).limit(1);
    let created = 0;
    if (!existing) {
      await tx.insert(banners).values(INITIAL_BANNERS.map((banner, index) => ({ ...banner, layout: "tipografico" as const, enabled: true, sortOrder: index })));
      created = INITIAL_BANNERS.length;
    }
    await tx.insert(settings).values({ key: INITIAL_BANNERS_MARK, value: { done: true, created } });
    return created;
  });
}
