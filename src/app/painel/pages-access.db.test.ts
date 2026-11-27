/**
 * TODAS AS PÁGINAS do painel × perfis (banco de teste; cookies e navegação simulados): cada página responde como
 * manda a tabela "página → guarda" de docs/permissoes.md (seção 7.2) — renderiza, redireciona ou 404.
 *
 * - A tabela abaixo é escrita À MÃO (não é derivada do código): página nova sem linha aqui faz o teste falhar,
 *   e trocar o guarda de uma página sem atualizar a tabela também.
 * - Cada página é chamada de verdade (a função `default` do `page.tsx`) com a sessão de cada perfil: o guarda roda
 *   primeiro; para quem passa, a página carrega os dados do banco de teste.
 * - `src/app/painel/agenda/**` está sendo reescrita em paralelo: lá só conferimos, pelo código-fonte, que toda
 *   página começa por um guarda (nenhuma página do painel fica sem barreira).
 * - O isolamento por projeto do funcionário (projeto, tarefas e ações de projeto ALHEIO) está em
 *   `funcionario-scope.db.test.ts`.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { isValidElement } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (browser.token && name.endsWith("nos_session") ? { name, value: browser.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`REDIRECT:${target}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/painel",
  useRouter: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidateTag: () => {}, updateTag: () => {}, cacheTag: () => {}, cacheLife: () => {} }));

import { db } from "@/db";
import { clients, financeEntries, proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { makeAccount, removeAccounts, type TestAccount } from "@/test/accounts";

const ROOT = path.join(process.cwd(), "src/app/painel");
const LOGIN = "REDIRECT:/login";
const NO_ACCESS = "REDIRECT:/login?aviso=sem-acesso";
const PANEL = "REDIRECT:/painel";

// ------------------------------------------------------------------ a tabela
/** Quem PASSA em cada tipo de guarda (docs/permissoes.md, seções 3 e 4). Os demais são barrados. */
const ADMINS = ["admin", "socio"] as const;
const INTEGRAL = ["admin", "socio", "tecnico"] as const;
const OPERATION = ["admin", "socio", "tecnico", "gestor"] as const;
const ALL_PANEL = ["admin", "socio", "tecnico", "gestor", "funcionario"] as const;

const ALLOWED: Record<string, readonly UserRole[]> = {
  // qualquer conta do painel (requirePanelUser)
  painel: ALL_PANEL,
  // acesso integral (requireUser): demonstração do kit
  integral: INTEGRAL,
  // administradores e sócios (requireAdmin)
  admin: ADMINS,
  // módulo inteiro (requirePermission)
  "leads:ver": OPERATION,
  "leads:editar": OPERATION,
  "clientes:ver": OPERATION,
  "clientes:editar": OPERATION,
  "propostas:ver": OPERATION,
  "propostas:editar": OPERATION,
  "contratos:ver": OPERATION,
  "contratos:editar": OPERATION,
  "projetos:editar": OPERATION,
  "conteudo:ver": OPERATION,
  "conteudo:editar": OPERATION,
  "marca:ver": OPERATION,
  "marca:editar": OPERATION,
  "financeiro:ver": INTEGRAL,
  "financeiro:editar": INTEGRAL,
  "site:ver": INTEGRAL,
  "site:editar": INTEGRAL,
  "config:ver": INTEGRAL,
  "usuarios:ver": ADMINS,
  "auditoria:ver": ADMINS,
  "dados:baixar": ADMINS,
  // módulo inteiro OU só os projetos da pessoa (requireScopedPermission): a lista vem filtrada
  "escopo:projetos:ver": ALL_PANEL,
  "escopo:tarefas:ver": ALL_PANEL,
  // por projeto (requireProjectPermission): quem vê o módulo inteiro passa; o funcionário, só se for membro
  "projeto:projetos:ver": OPERATION,
};

/** O texto do guarda (primeiro `await` da página) que corresponde a cada linha da tabela. */
function guardCall(spec: string): string {
  if (spec === "painel") return "requirePanelUser(";
  if (spec === "integral") return "requireUser(";
  if (spec === "admin") return "requireAdmin(";
  const parts = spec.split(":");
  if (parts[0] === "escopo") return `requireScopedPermission("${parts[1]}", "${parts[2]}")`;
  if (parts[0] === "projeto") return `requireProjectPermission("${parts[1]}", "${parts[2]}",`;
  return `requirePermission("${parts[0]}", "${parts[1]}")`;
}

const site = (section: string): Record<string, string> => ({
  [`site/${section}/page.tsx`]: "site:ver",
  [`site/${section}/novo/page.tsx`]: "site:editar",
  [`site/${section}/[id]/page.tsx`]: "site:editar",
});

/** PÁGINA → GUARDA (docs/permissoes.md, 7.2). Caminhos relativos a `src/app/painel`. */
const PAGES: Record<string, string> = {
  "page.tsx": "painel",
  "[...resto]/page.tsx": "painel",
  "ajuda/page.tsx": "painel",
  "conta/page.tsx": "painel",
  "conta/senha/page.tsx": "painel",
  "notificacoes/page.tsx": "painel",
  "kit/page.tsx": "integral",
  "kit/widgets/page.tsx": "integral",

  "leads/page.tsx": "leads:ver",
  "leads/[id]/page.tsx": "leads:ver",
  "leads/novo/page.tsx": "leads:editar",

  "clientes/page.tsx": "clientes:ver",
  "clientes/[id]/page.tsx": "clientes:ver",
  "clientes/novo/page.tsx": "clientes:editar",
  "clientes/[id]/editar/page.tsx": "clientes:editar",

  "orcamentos/page.tsx": "propostas:ver",
  "orcamentos/[id]/page.tsx": "propostas:ver",
  "orcamentos/modelos/page.tsx": "propostas:ver",
  "orcamentos/novo/page.tsx": "propostas:editar",

  "contratos/page.tsx": "contratos:ver",
  "contratos/[id]/page.tsx": "contratos:ver",
  "contratos/modelos/page.tsx": "contratos:ver",
  "contratos/modelos/[id]/page.tsx": "contratos:ver",
  "contratos/novo/page.tsx": "contratos:editar",
  "contratos/[id]/editar/page.tsx": "contratos:editar",
  "contratos/modelos/novo/page.tsx": "contratos:editar",

  "projetos/page.tsx": "escopo:projetos:ver",
  "projetos/[id]/page.tsx": "projeto:projetos:ver",
  "projetos/novo/page.tsx": "projetos:editar",
  "projetos/[id]/editar/page.tsx": "projetos:editar",

  "tarefas/page.tsx": "escopo:tarefas:ver",

  "conteudo/page.tsx": "conteudo:ver",
  "conteudo/[id]/page.tsx": "conteudo:ver",
  "conteudo/novo/page.tsx": "conteudo:editar",

  "financeiro/page.tsx": "financeiro:ver",
  "financeiro/[id]/page.tsx": "financeiro:ver",
  "financeiro/novo/page.tsx": "financeiro:editar",
  "financeiro/novo/parcelas/page.tsx": "financeiro:editar",

  "marca/page.tsx": "marca:ver",
  "marca/[id]/page.tsx": "marca:ver",
  "marca/novo/page.tsx": "marca:editar",

  "site/page.tsx": "site:ver",
  "site/inicio/page.tsx": "site:ver",
  "site/textos/page.tsx": "site:ver",
  "site/textos/[secao]/page.tsx": "site:editar",
  "site/metricas/page.tsx": "site:ver",
  ...site("banners"),
  ...site("avisos"),
  ...site("servicos"),
  ...site("portfolio"),
  ...site("pacotes"),
  ...site("depoimentos"),
  ...site("faq"),

  "config/page.tsx": "config:ver",
  "config/propostas/page.tsx": "config:ver",
  "config/notificacoes/page.tsx": "admin",
  "config/usuarios/page.tsx": "usuarios:ver",
  "config/usuarios/[id]/page.tsx": "usuarios:ver",
  "config/auditoria/page.tsx": "auditoria:ver",
  "config/dados/page.tsx": "dados:baixar",
};

// ------------------------------------------------------------------ varredura
function pageFiles(dir = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const isAgenda = (file: string) => relative(file).startsWith("agenda/");

/** O corpo da função `default` da página (do `export default` até o fim do arquivo). */
function defaultExportBody(file: string): string {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("export default");
  return start === -1 ? "" : source.slice(start);
}

type PageModule = { default: (props: { params: Promise<Record<string, unknown>>; searchParams: Promise<Record<string, string>> }) => unknown; instant?: unknown };
const pages: { key: string; file: string; run: PageModule["default"]; instant: unknown }[] = [];
const accounts = {} as Record<UserRole, TestAccount>;

/** Páginas que só existem com um parâmetro na URL (`?proposta=`): sem ele, quem passa do guarda recebe 404. */
const NEEDS_QUERY = ["financeiro/novo/parcelas/page.tsx"];

/** Um id que não existe: para quem PASSA do guarda, a página de detalhe responde 404. */
const MISSING = "999999";
function propsFor(key: string) {
  const params: Record<string, unknown> = {};
  if (key.includes("[id]")) params.id = MISSING;
  if (key.includes("[secao]")) params.secao = "general";
  if (key.includes("[...resto]")) params.resto = ["nao-existe"];
  return { params: Promise.resolve(params), searchParams: Promise.resolve({}) };
}

/** Chama a página e resume o que aconteceu: "RENDER", "NOT_FOUND" ou o redirecionamento. */
async function visit(key: string, props = propsFor(key)): Promise<string> {
  const page = pages.find((item) => item.key === key);
  if (!page) throw new Error(`página não encontrada: ${key}`);
  try {
    const result = await page.run(props);
    return isValidElement(result) ? "RENDER" : `devolveu ${typeof result}`;
  } catch (error) {
    const message = (error as Error)?.message ?? "";
    if (message.startsWith("REDIRECT:") || message === "NOT_FOUND") return message;
    throw error;
  }
}

/** O que cada perfil BARRADO recebe: quem tem acesso integral volta ao início do painel; os demais, ao aviso do login. */
const deniedOutcome = (role: UserRole) => ((INTEGRAL as readonly UserRole[]).includes(role) ? PANEL : NO_ACCESS);

beforeAll(async () => {
  for (const file of pageFiles().filter((item) => !isAgenda(item))) {
    const mod = (await import(/* @vite-ignore */ file)) as PageModule;
    pages.push({ key: relative(file), file, run: mod.default, instant: mod.instant });
  }
  for (const role of USER_ROLES) accounts[role] = await makeAccount(role);
}, 120_000);
afterAll(removeAccounts);

describe("páginas do painel: a tabela página → guarda", () => {
  it("toda página do painel está na tabela (página nova precisa declarar o guarda aqui e em docs/permissoes.md)", () => {
    const found = pageFiles()
      .filter((file) => !isAgenda(file))
      .map(relative)
      .sort();
    expect(found).toEqual(Object.keys(PAGES).sort());
    expect(found.length).toBeGreaterThan(60);
  });

  it("no código, a PRIMEIRA coisa que cada página espera é o guarda da tabela", () => {
    const wrong: string[] = [];
    for (const [key, spec] of Object.entries(PAGES)) {
      const body = defaultExportBody(path.join(ROOT, key));
      const firstAwait = /await\s+([\s\S]*?)[;\n]/.exec(body)?.[1] ?? "";
      if (!firstAwait.replace(/^\(?/, "").startsWith(guardCall(spec))) wrong.push(`${key}: esperado ${guardCall(spec)}…, achado "${firstAwait.slice(0, 70)}"`);
    }
    // a página do projeto lê o id da URL (`await params`) antes do guarda porque o guarda PRECISA do id
    expect(wrong.filter((line) => !line.startsWith("projetos/[id]/page.tsx"))).toEqual([]);
    expect(defaultExportBody(path.join(ROOT, "projetos/[id]/page.tsx"))).toMatch(/await requireProjectPermission\("projetos", "ver", /);
  });

  it("agenda (em reescrita): toda página começa por um guarda e nenhuma fica aberta a quem não é do painel", () => {
    const open: string[] = [];
    for (const file of pageFiles().filter(isAgenda)) {
      const firstAwait = /await\s+(\w+)\(/.exec(defaultExportBody(file))?.[1] ?? "";
      if (!/^require(Permission|User|Admin|ProjectPermission|ScopedPermission)$/.test(firstAwait)) open.push(`${relative(file)} (${firstAwait || "nenhum await"})`);
    }
    expect(open).toEqual([]);
  });

  it("toda página do painel é `async` e exporta `instant = false` (regra do CLAUDE.md)", () => {
    const wrong = pages.filter((page) => page.instant !== false || page.run.constructor.name !== "AsyncFunction").map((page) => page.key);
    expect(wrong).toEqual([]);
  });

  it("sem sessão: toda página manda para o login", async () => {
    browser.token = null;
    for (const key of Object.keys(PAGES)) expect(await visit(key), key).toBe(LOGIN);
  });

  it("conta com senha provisória: nada abre antes da troca — só a própria tela de troca", async () => {
    const pending = await makeAccount("admin", { mustChangePassword: true });
    browser.token = pending.token;
    for (const key of Object.keys(PAGES)) {
      const result = await visit(key);
      if (key === "conta/senha/page.tsx") expect(result, key).toBe("RENDER");
      else expect(result, key).toBe("REDIRECT:/painel/conta/senha?obrigatoria=1");
    }
    browser.token = null;
  });

  for (const role of USER_ROLES) {
    it(`${role.toUpperCase()}: cada página responde como a tabela manda`, async () => {
      browser.token = accounts[role].token;
      const wrong: string[] = [];
      for (const [key, spec] of Object.entries(PAGES)) {
        const allowed = ALLOWED[spec];
        if (!allowed) throw new Error(`guarda sem linha em ALLOWED: ${spec}`);
        const result = await visit(key);
        // o detalhe do projeto com um id que não existe: 404 para quem vê tudo; para o funcionário, o mesmo
        // "sem acesso" de um projeto alheio (não revela nem que o projeto não existe)
        const passes = allowed.includes(role);
        const expected = passes ? ["RENDER", "NOT_FOUND"] : [deniedOutcome(role)];
        if (!expected.includes(result)) wrong.push(`${key} [${spec}] → ${result} (esperado ${expected.join(" ou ")})`);
        // página sem parâmetro na URL precisa RENDERIZAR de verdade para quem pode (não só "não redirecionar")
        const staticPage = !/\[(id|\.\.\.resto)\]/.test(key) && !NEEDS_QUERY.includes(key);
        if (passes && staticPage && result !== "RENDER") wrong.push(`${key} [${spec}] → ${result} (deveria renderizar)`);
      }
      browser.token = null;
      expect(wrong).toEqual([]);
    }, 120_000);
  }

  it("resumo por perfil: quantas páginas cada um abre (freelancer e cliente: NENHUMA)", async () => {
    const count = async (role: UserRole) => {
      browser.token = accounts[role].token;
      let opened = 0;
      for (const key of Object.keys(PAGES)) if (["RENDER", "NOT_FOUND"].includes(await visit(key))) opened++;
      browser.token = null;
      return opened;
    };
    const total = Object.keys(PAGES).length;
    expect(await count("freelancer")).toBe(0);
    expect(await count("cliente")).toBe(0);
    expect(await count("admin")).toBe(total);
    expect(await count("socio")).toBe(total);
    // funcionário: visão geral, não-encontrada, ajuda, conta, troca de senha, notificações, lista de projetos e
    // tarefas (o detalhe de um projeto só abre para os projetos DELE — aqui o id não existe). As páginas da
    // agenda ficam fora desta tabela: o alcance dele lá é testado em src/server/agenda/funcionario.db.test.ts
    expect(await count("funcionario")).toBe(8);
    const tecnico = await count("tecnico");
    const gestor = await count("gestor");
    expect(tecnico).toBeLessThan(total);
    expect(gestor).toBeLessThan(tecnico);
    expect(gestor).toBeGreaterThan(await count("funcionario"));
  }, 120_000);
});

describe("o que a página MOSTRA depende do perfil (blocos de outros módulos)", () => {
  type Element = { props: Record<string, unknown> };
  /** Procura, na árvore devolvida pela página, o primeiro elemento que tenha a propriedade `prop`. */
  function findProp(node: unknown, prop: string): unknown {
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findProp(child, prop);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    if (!isValidElement(node)) return undefined;
    const props = (node as Element).props;
    if (prop in props) return props[prop];
    return findProp(props.children, prop);
  }

  it("proposta aceita com parcelas: o gestor NÃO recebe os lançamentos do financeiro; o sócio recebe", async () => {
    const [client] = await db.insert(clients).values({ name: "[Teste] cliente da proposta" }).returning({ id: clients.id });
    const [proposal] = await db
      .insert(proposals)
      .values({ number: `T-${Date.now()}`, version: 1, title: "[Teste] proposta com parcelas", clientId: client.id, status: "aceita", createdBy: accounts.admin.id })
      .returning({ id: proposals.id });
    await db.insert(financeEntries).values({ type: "receita", category: "servico", description: "[Teste] SEGREDO-PARCELA", amountCents: 123_456, dueDate: "2026-12-10", proposalId: proposal.id, clientId: client.id });
    const page = pages.find((item) => item.key === "orcamentos/[id]/page.tsx")!;
    const open = async () => findProp(await page.run({ params: Promise.resolve({ id: String(proposal.id) }), searchParams: Promise.resolve({}) }), "control") as { finance: unknown };

    browser.token = accounts.socio.token;
    const forPartner = await open();
    expect(JSON.stringify(forPartner.finance)).toContain("SEGREDO-PARCELA");

    browser.token = accounts.gestor.token;
    const forManager = await open();
    expect(forManager.finance).toBeNull();
    expect(JSON.stringify(forManager)).not.toContain("SEGREDO-PARCELA");
    expect(JSON.stringify(forManager)).not.toContain("123456");
    browser.token = null;

    await db.delete(financeEntries).where(eq(financeEntries.proposalId, proposal.id));
    await db.delete(proposals).where(eq(proposals.id, proposal.id));
    await db.delete(clients).where(eq(clients.id, client.id));
  });
});
