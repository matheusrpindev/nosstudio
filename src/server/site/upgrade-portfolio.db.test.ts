import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { portfolioProjects } from "@/db/schema";
import { PORTFOLIO_CATEGORIES } from "@/lib/domain";
import { PORTFOLIO_CATEGORY_RENAMES, upgradePortfolioCategories } from "./upgrade-portfolio";

/**
 * A categoria "videos" do portfólio virou "audiovisual" (briefing v2, seção 08). O teste cria projetos como um
 * banco antigo os teria — um deles ainda com "videos", gravado em SQL puro porque o nome saiu do enum —, roda a
 * atualização duas vezes e confere que só a categoria mudou.
 */
const created: number[] = [];
const stamp = Date.now();

beforeAll(async () => {
  const rows = await db
    .insert(portfolioProjects)
    .values([
      { slug: `teste-upgrade-video-${stamp}`, title: "[Teste] Filme antigo", category: "fotografia", summary: "Resumo dos sócios", published: true, featured: true, sortOrder: 7 },
      { slug: `teste-upgrade-foto-${stamp}`, title: "[Teste] Ensaio", category: "fotografia" },
      { slug: `teste-upgrade-casamento-${stamp}`, title: "[Teste] Casamento", category: "casamentos" },
    ])
    .returning({ id: portfolioProjects.id });
  created.push(...rows.map((row) => row.id));
  await db.run(sql`update portfolio_projects set category = 'videos' where id = ${created[0]}`);
});

afterAll(async () => {
  if (created.length) await db.delete(portfolioProjects).where(inArray(portfolioProjects.id, created));
});

const load = async () => {
  const rows = await db.select().from(portfolioProjects).where(inArray(portfolioProjects.id, created));
  return created.map((id) => rows.find((row) => row.id === id)!);
};

describe("categorias do portfólio no briefing v2", () => {
  it("todo nome antigo aponta para uma categoria que existe — e nenhum nome antigo continua no enum", () => {
    for (const [from, to] of Object.entries(PORTFOLIO_CATEGORY_RENAMES)) {
      expect(PORTFOLIO_CATEGORIES).toContain(to);
      expect(PORTFOLIO_CATEGORIES as readonly string[]).not.toContain(from);
    }
    expect([...PORTFOLIO_CATEGORIES]).toEqual(["audiovisual", "fotografia", "design", "marketing", "identidade_visual", "eventos", "casamentos"]);
  });

  it("primeira execução: 'videos' vira 'audiovisual' e nada mais muda no projeto", async () => {
    const before = await load();
    expect(before[0].category as string).toBe("videos");

    expect(await upgradePortfolioCategories()).toBe(1);

    const after = await load();
    expect(after[0].category).toBe("audiovisual");
    expect({ ...after[0], category: "", updatedAt: null }).toEqual({ ...before[0], category: "", updatedAt: null });
    // as outras categorias ficam como estavam
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it("segunda execução: não há mais o que atualizar", async () => {
    const before = await load();
    expect(await upgradePortfolioCategories()).toBe(0);
    expect(await load()).toEqual(before);
  });
});
