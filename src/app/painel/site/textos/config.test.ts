import { describe, expect, it } from "vitest";
import { defaultSiteContent, SITE_CONTENT_KEYS, siteContentSchemas } from "@/lib/site/content";
import { coveredLeaves, maxLengthAt, SECTION_ORDER, SITE_SECTIONS, schemaLeaves, sectionFields } from "./config";

describe("mapa do editor de textos", () => {
  it("tem uma configuração para cada seção do schema, na ordem de exibição", () => {
    expect(Object.keys(SITE_SECTIONS).sort()).toEqual([...SITE_CONTENT_KEYS].sort());
    expect([...SECTION_ORDER].sort()).toEqual([...SITE_CONTENT_KEYS].sort());
  });

  for (const key of SITE_CONTENT_KEYS) {
    it(`${key}: todos os campos do schema são editáveis (e nenhum campo do mapa sobra)`, () => {
      const leaves = new Set(schemaLeaves(key));
      const covered = coveredLeaves(SITE_SECTIONS[key]);
      expect(new Set(covered).size, "campos mapeados duas vezes").toBe(covered.length);
      expect([...leaves].filter((leaf) => !covered.includes(leaf)), "campos do schema SEM editor").toEqual([]);
      expect(covered.filter((leaf) => !leaves.has(leaf)), "campos do mapa que não existem no schema").toEqual([]);
    });

    it(`${key}: os padrões do briefing têm exatamente os campos do schema`, () => {
      expect(siteContentSchemas[key].safeParse(defaultSiteContent[key]).success).toBe(true);
    });

    it(`${key}: todo campo tem rótulo e, se for texto, um limite de caracteres vindo do schema`, () => {
      const section = SITE_SECTIONS[key];
      expect(section.groups.length).toBeGreaterThan(0);
      for (const field of sectionFields(section)) {
        expect(field.label.trim(), field.path).not.toBe("");
        if (field.type === "text" || field.type === "textarea" || field.type === "markdown" || field.type === "email" || field.type === "phone" || field.type === "instagram") {
          expect(maxLengthAt(key, field.path), `limite de ${field.path}`).toBeGreaterThan(0);
        }
        if (field.type === "list") {
          expect(maxLengthAt(key, field.path), `máximo de itens de ${field.path}`).toBeGreaterThan(0);
          for (const item of field.items) {
            expect(item.label.trim()).not.toBe("");
            if (item.type !== "image") expect(maxLengthAt(key, `${field.path}[].${item.key}`)).toBeGreaterThan(0);
          }
        }
      }
    });
  }

  it("lê limites do schema", () => {
    expect(maxLengthAt("home", "hero.title")).toBe(120);
    expect(maxLengthAt("seo", "pages.home.description")).toBe(180);
    expect(maxLengthAt("differentials", "items")).toBe(8);
    expect(maxLengthAt("differentials", "items[].title")).toBe(120);
    expect(maxLengthAt("weddingsPage", "events.items[].text")).toBe(600);
  });
});
