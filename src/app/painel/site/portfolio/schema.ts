/**
 * Validação do formulário de projeto do portfólio (zod). Fica fora de `actions.ts` ("use server" só exporta
 * funções assíncronas) para poder ser testada — schema.test.ts.
 *
 * O que NÃO é conferido aqui: as regras de publicação (capa e texto alternativo das imagens), que dependem do
 * banco — ver `findPublishBlockers` em src/server/site/admin/portfolio.ts e `publishBlockers` em
 * src/lib/site/portfolio.ts.
 */
import "@/lib/zod-setup";
import { z } from "zod";
import type { PortfolioBeforeAfter } from "@/db/schema";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_ORIGINS } from "@/lib/domain";
import { safeUrl, videoEmbedUrl } from "@/lib/format";
import { f } from "@/server/action";
import { idListField, slugField, textListField, videoField } from "@/server/site/admin/form";
import type { PortfolioInput } from "@/server/site/admin/portfolio";
import { PORTFOLIO_LIMITS } from "./limits";


/** Campos enviados como JSON num `<input type="hidden">` (listas editadas no cliente). */
export const PORTFOLIO_JSON_FIELDS = ["servicesDone", "gallery", "extraVideoUrls", "beforeAfter", "backstage", "relatedProjectIds"] as const;

/** Vídeos adicionais: linhas vazias saem; cada link precisa ser do YouTube ou do Vimeo; o valor salvo é a URL normalizada, sem repetição. */
const extraVideosField = z
  .array(z.string().trim().max(300, "Máximo de 300 caracteres por link."))
  .max(PORTFOLIO_LIMITS.extraVideos, `No máximo ${PORTFOLIO_LIMITS.extraVideos} vídeos adicionais.`)
  .transform((rows) => rows.filter(Boolean))
  .superRefine((rows, ctx) => {
    const bad = rows.findIndex((url) => videoEmbedUrl(url) === null);
    if (bad >= 0) ctx.addIssue({ code: "custom", message: `O vídeo adicional ${bad + 1} não é um link do YouTube ou do Vimeo (ex.: https://youtu.be/…).` });
  })
  .transform((rows) => [...new Set(rows.map((url) => safeUrl(url)))]);

const mediaRef = z.number().int().positive().nullable();

/** Pares "antes e depois": linha totalmente vazia é descartada; par incompleto é erro. */
const beforeAfterField = z
  .array(z.object({ beforeMediaId: mediaRef, afterMediaId: mediaRef, caption: z.string().trim().max(PORTFOLIO_LIMITS.caption, `Máximo de ${PORTFOLIO_LIMITS.caption} caracteres na legenda.`) }))
  .max(PORTFOLIO_LIMITS.beforeAfter, `No máximo ${PORTFOLIO_LIMITS.beforeAfter} pares de antes e depois.`)
  .transform((rows) => rows.filter((row) => row.beforeMediaId || row.afterMediaId || row.caption))
  .superRefine((rows, ctx) => {
    const bad = rows.findIndex((row) => !row.beforeMediaId || !row.afterMediaId);
    if (bad >= 0) ctx.addIssue({ code: "custom", message: `O par ${bad + 1} precisa das duas imagens: a de antes e a de depois.` });
  })
  .transform((rows) => rows as PortfolioBeforeAfter[]);

export const portfolioSchema = z.object({
  id: f.optionalId(),
  // básico
  title: f.text(140, "Informe o título do projeto."),
  slug: slugField(),
  category: z.enum(PORTFOLIO_CATEGORIES, { error: "Selecione a categoria." }),
  projectDate: f.optionalDate(),
  clientName: f.optionalText(120),
  showClient: f.checkbox(),
  summary: f.optionalText(300),
  description: f.optionalText(8000),
  servicesDone: textListField(PORTFOLIO_LIMITS.services, 120),
  // estudo de caso
  objective: f.optionalText(PORTFOLIO_LIMITS.caseText),
  challenge: f.optionalText(PORTFOLIO_LIMITS.caseText),
  solution: f.optionalText(PORTFOLIO_LIMITS.caseText),
  results: f.optionalText(PORTFOLIO_LIMITS.caseText),
  // mídia
  cover: f.optionalId(),
  gallery: idListField(PORTFOLIO_LIMITS.gallery),
  videoUrl: videoField(),
  extraVideoUrls: extraVideosField,
  beforeAfter: beforeAfterField,
  backstage: idListField(PORTFOLIO_LIMITS.backstage),
  // relacionados
  relatedProjectIds: z.array(z.number().int().positive()).max(PORTFOLIO_LIMITS.related, `No máximo ${PORTFOLIO_LIMITS.related} projetos relacionados.`),
  // publicação
  origin: z.enum(PORTFOLIO_ORIGINS, { error: "Selecione a origem do trabalho." }),
  originNote: f.optionalText(PORTFOLIO_LIMITS.originNote),
  featured: f.checkbox(),
  published: f.checkbox(),
});

export type PortfolioFormData = z.infer<typeof portfolioSchema>;

/**
 * Dados validados do formulário → o que é gravado. Três regras de coerência ficam aqui:
 * - "exibir o nome do cliente" só vale com um nome preenchido;
 * - a observação da origem só é guardada para experiência anterior;
 * - um projeto não é relacionado dele mesmo, e o vídeo principal não se repete nos adicionais.
 */
export function toPortfolioInput(data: PortfolioFormData): PortfolioInput {
  const { id, cover, ...rest } = data;
  const main = rest.videoUrl ? videoEmbedUrl(rest.videoUrl) : null;
  return {
    ...rest,
    coverMediaId: cover,
    showClient: rest.showClient && Boolean(rest.clientName),
    originNote: rest.origin === "experiencia_anterior" ? rest.originNote : "",
    extraVideoUrls: rest.extraVideoUrls.filter((url) => videoEmbedUrl(url) !== main),
    relatedProjectIds: [...new Set(rest.relatedProjectIds)].filter((projectId) => projectId !== id),
  };
}
