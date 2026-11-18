/**
 * Divide o manual (Markdown) em seções para a página de ajuda: cada título "## " vira uma seção com âncora
 * própria e entra no sumário. Arquivo puro (sem disco), coberto por `manual.test.ts`.
 */
export type ManualSection = { id: string; title: string; markdown: string };
export type ParsedManual = { title: string; intro: string; sections: ManualSection[] };

/** "Do contato ao contrato" → "do-contato-ao-contrato". */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseManual(source: string): ParsedManual {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let title = "Manual do painel";
  const intro: string[] = [];
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const h1 = /^# (.+)$/.exec(line);
    if (h1 && !current && intro.every((item) => !item.trim())) {
      title = h1[1].trim();
      continue;
    }
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      current = { title: h2[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    (current ? current.lines : intro).push(line);
  }

  const used = new Set<string>();
  return {
    title,
    intro: intro.join("\n").trim(),
    sections: sections.map((section, index) => {
      const base = slugify(section.title) || `secao-${index + 1}`;
      let id = base;
      for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
      used.add(id);
      return { id, title: section.title, markdown: section.lines.join("\n").trim() };
    }),
  };
}
