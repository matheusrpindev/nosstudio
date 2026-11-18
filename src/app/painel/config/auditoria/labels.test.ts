import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_LABELS, actionLabel, ENTITY_LABELS, entityLabel } from "./labels";

/**
 * Varre o código atrás de chamadas `logAudit({ action: …, entity: … })` e confere que cada valor gravado tem
 * rótulo em português na tela de Auditoria. Lê os textos entre aspas da expressão (inclusive os dois lados de um
 * `a ? "x" : "y"`). Se um dia `action`/`entity` vier só de uma variável, o teste avisa: dê o rótulo e liste o
 * valor em `DYNAMIC` abaixo.
 */
const ROOT = process.cwd();
const DYNAMIC: Record<"action" | "entity", string[]> = { action: [], entity: [] };

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

/** Texto do objeto passado a cada `logAudit({ … })` do arquivo. */
function auditCalls(source: string): string[] {
  const calls: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf("logAudit({", from);
    if (start === -1) return calls;
    let depth = 0;
    let index = start + "logAudit(".length;
    for (; index < source.length; index++) {
      if (source[index] === "{") depth++;
      else if (source[index] === "}" && --depth === 0) break;
    }
    calls.push(source.slice(start + "logAudit(".length, index + 1));
    from = index;
  }
}

/** A expressão de uma propriedade de primeiro nível (`action: <expr>,`) do objeto. */
function propertyExpression(objectText: string, property: string): string | null {
  const match = new RegExp(`[{,\\s]${property}:`).exec(objectText);
  if (!match) return null;
  let depth = 0;
  let quote = "";
  let expression = "";
  for (const char of objectText.slice(match.index + match[0].length)) {
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "{" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if ((char === "," || char === "}") && depth === 0) break;
    expression += char;
  }
  return expression.trim();
}

const literals = (expression: string) => [...expression.matchAll(/"([^"]+)"|'([^']+)'/g)].map((match) => match[1] ?? match[2]);

function collect(property: "action" | "entity") {
  const found = new Map<string, string>(); // valor → arquivo
  const opaque: string[] = [];
  for (const file of [...sourceFiles("src"), ...sourceFiles("scripts")]) {
    if (file === "src/lib/audit.ts") continue; // a própria função (repassa `input.action`)
    // sem os comentários de bloco: exemplos em JSDoc ("entity: \"thing\"") não são chamadas de verdade
    const source = readFileSync(path.join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const call of auditCalls(source)) {
      const expression = propertyExpression(call, property);
      if (expression === null) continue;
      const values = literals(expression);
      if (values.length === 0) opaque.push(`${file}: ${property}: ${expression}`);
      for (const value of values) found.set(value, file);
    }
  }
  for (const value of DYNAMIC[property]) found.set(value, "(DYNAMIC)");
  return { found, opaque };
}

describe("rótulos da auditoria", () => {
  it("o leitor de chamadas entende as formas usadas no projeto", () => {
    const [call] = auditCalls('await logAudit({ user, action: id === null ? "create" : "update", entity: "faq", entityId: row.id, summary: `Salvou "x", ok` });');
    expect(literals(propertyExpression(call, "action")!)).toEqual(["create", "update"]);
    expect(literals(propertyExpression(call, "entity")!)).toEqual(["faq"]);
    expect(propertyExpression('{ user, action: "login" }', "entity")).toBeNull();
    expect(propertyExpression("{\n  action: kind,\n  entity: \"x\" }", "action")).toBe("kind");
  });

  it("toda AÇÃO gravada por logAudit tem rótulo em português", () => {
    const { found, opaque } = collect("action");
    expect(found.size).toBeGreaterThan(10); // a varredura achou as chamadas
    expect(opaque, "ação vinda de variável: dê um rótulo e liste o valor em DYNAMIC").toEqual([]);
    const missing = [...found].filter(([value]) => !(value in ACTION_LABELS)).map(([value, file]) => `${value} (${file})`);
    expect(missing, "acrescente em ACTION_LABELS (src/app/painel/config/auditoria/labels.ts)").toEqual([]);
  });

  it("toda ENTIDADE gravada por logAudit tem rótulo em português", () => {
    const { found, opaque } = collect("entity");
    expect(found.size).toBeGreaterThan(10);
    expect(opaque, "entidade vinda de variável: dê um rótulo e liste o valor em DYNAMIC").toEqual([]);
    const missing = [...found].filter(([value]) => !(value in ENTITY_LABELS)).map(([value, file]) => `${value} (${file})`);
    expect(missing, "acrescente em ENTITY_LABELS (src/app/painel/config/auditoria/labels.ts)").toEqual([]);
  });

  it("valor desconhecido (registro antigo) aparece como está; sem entidade, vazio", () => {
    expect(actionLabel("login_falhou")).toBe("Login recusado");
    expect(actionLabel("acao_antiga")).toBe("acao_antiga");
    expect(entityLabel("media")).toBe("Arquivo");
    expect(entityLabel("coisa_antiga")).toBe("coisa_antiga");
    expect(entityLabel(null)).toBe("");
  });
});
