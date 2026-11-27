import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Módulos fora do servidor que criam `z.object` precisam carregar o zod-setup ANTES (ver zod-setup.ts). */
describe("zod sem eval no navegador", () => {
  it("todo módulo que pode ir ao navegador e cria z.object importa @/lib/zod-setup na primeira importação", () => {
    const files = globSync("src/**/*.{ts,tsx}").filter((file) => !/\.test\.tsx?$|^src\/server\/|actions\.ts$|\/api\/|^src\/db\/|^src\/lib\/zod-setup\.ts$|route\.ts$/.test(file));
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      if (!/\bz\.(object|strictObject|looseObject)\(/.test(source) || source.includes('import "server-only"')) return false;
      const firstImport = source.match(/^import .*$/m)?.[0];
      return firstImport !== 'import "@/lib/zod-setup";';
    });
    expect(offenders).toEqual([]);
  });
});
