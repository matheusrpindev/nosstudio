import { describe, expect, it } from "vitest";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import {
  ACTIONS,
  can,
  canEverywhere,
  isAdminRole,
  isPermissionKey,
  MODULE_LABELS,
  MODULES,
  NO_OVERRIDES,
  overridesProblem,
  parseOverrides,
  PERMISSION_ACTION_LABELS,
  permissionScope,
  permissionTable,
  RESERVED_MODULES,
  rolePermission,
  type Module,
  type PermissionKey,
  type PermissionOverrides,
} from "./matrix";
import { permissionOverridesSchema } from "./schema";

/**
 * A MATRIZ INTEIRA, escrita de novo aqui de propósito: perfil × módulo × [ver, editar, excluir, baixar,
 * compartilhar]. T = módulo inteiro · P = só nos projetos em que é membro · - = não.
 * Mudou a matriz em matrix.ts? Este teste falha até a tabela abaixo (e docs/permissoes.md) acompanhar — uma
 * permissão nunca muda "sem querer".
 */
const EXPECTED: Record<UserRole, Record<Module, string>> = {
  admin: all("TTTTT"),
  socio: all("TTTTT"),
  tecnico: { ...all("TTTTT"), societario: "-----", usuarios: "-----", auditoria: "-----", dados: "-----" },
  gestor: {
    leads: "TTTTT",
    clientes: "TT-TT",
    propostas: "TTTTT",
    contratos: "TT-TT",
    projetos: "TT-TT",
    tarefas: "TTTTT",
    agenda: "TTTTT",
    conteudo: "TTTTT",
    financeiro: "-----",
    societario: "-----",
    marca: "TTTTT",
    arquivos: "TTTTT",
    equipe: "TT-TT",
    site: "-----",
    relatorios: "-----",
    usuarios: "-----",
    config: "-----",
    auditoria: "-----",
    dados: "-----",
  },
  funcionario: {
    ...all("-----"),
    projetos: "PP-P-",
    tarefas: "PP-P-",
    agenda: "PP-P-",
    conteudo: "PP-P-",
    arquivos: "PP-P-",
    marca: "P--P-",
  },
  freelancer: all("-----"),
  cliente: all("-----"),
};

function all(row: string): Record<Module, string> {
  return Object.fromEntries(MODULES.map((mod) => [mod, row])) as Record<Module, string>;
}
const letter = (scope: ReturnType<typeof permissionScope>) => (scope === "todos" ? "T" : scope === "projetos" ? "P" : "-");
const rowOf = (subject: Parameters<typeof permissionScope>[0], mod: Module) => ACTIONS.map((action) => letter(permissionScope(subject, mod, action))).join("");
const overrides = (grant: PermissionKey[] = [], deny: PermissionKey[] = []): PermissionOverrides => ({ grant, deny });

describe("matriz padrão: perfil × módulo × ação", () => {
  it("cobre todos os perfis, módulos e ações (nenhuma célula fora da tabela esperada)", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...USER_ROLES].sort());
    expect(MODULES).toHaveLength(19);
    expect(ACTIONS).toEqual(["ver", "editar", "excluir", "baixar", "compartilhar"]);
    for (const mod of MODULES) expect(MODULE_LABELS[mod]).toBeTruthy();
    for (const action of ACTIONS) expect(PERMISSION_ACTION_LABELS[action]).toBeTruthy();
  });

  for (const role of USER_ROLES) {
    it(`${role}: cada uma das ${MODULES.length * ACTIONS.length} células confere`, () => {
      for (const mod of MODULES) {
        expect(rowOf({ role }, mod), `${role} › ${mod}`).toBe(EXPECTED[role][mod]);
        // sem ajustes individuais, o efetivo é o padrão do perfil
        ACTIONS.forEach((action, index) => {
          expect(letter(rolePermission(role, mod, action)), `${role} › ${mod}:${action}`).toBe(EXPECTED[role][mod][index]);
          expect(can({ role, permissions: NO_OVERRIDES }, mod, action)).toBe(EXPECTED[role][mod][index] !== "-");
          expect(canEverywhere({ role }, mod, action)).toBe(EXPECTED[role][mod][index] === "T");
        });
      }
    });
  }

  it("admin e sócio: tudo, no módulo inteiro", () => {
    for (const role of ["admin", "socio"] as const) {
      expect(isAdminRole(role)).toBe(true);
      for (const mod of MODULES) for (const action of ACTIONS) expect(permissionScope({ role }, mod, action)).toBe("todos");
    }
    for (const role of USER_ROLES.filter((item) => item !== "admin" && item !== "socio")) expect(isAdminRole(role)).toBe(false);
  });

  it("freelancer e cliente: nada no painel", () => {
    for (const role of ["freelancer", "cliente"] as const) {
      for (const mod of MODULES) for (const action of ACTIONS) expect(can({ role }, mod, action), `${role} ${mod}:${action}`).toBe(false);
    }
  });

  it("societário e usuários só existem para admin e sócio", () => {
    for (const role of USER_ROLES) {
      for (const mod of RESERVED_MODULES) for (const action of ACTIONS) expect(can({ role }, mod, action)).toBe(isAdminRole(role));
    }
  });

  it("técnico: usa o painel, mas não gerencia usuários, não exporta, não vê auditoria nem societário", () => {
    const tecnico = { role: "tecnico" } as const;
    for (const mod of ["usuarios", "dados", "auditoria", "societario"] as const) for (const action of ACTIONS) expect(can(tecnico, mod, action)).toBe(false);
    for (const mod of ["leads", "clientes", "propostas", "contratos", "projetos", "financeiro", "site", "config"] as const) {
      expect(canEverywhere(tecnico, mod, "ver")).toBe(true);
      expect(canEverywhere(tecnico, mod, "editar")).toBe(true);
    }
  });

  it("gestor: opera, mas sem financeiro, societário, usuários, configurações e exportação", () => {
    const gestor = { role: "gestor" } as const;
    for (const mod of ["financeiro", "societario", "usuarios", "config", "dados", "auditoria", "site", "relatorios"] as const) {
      for (const action of ACTIONS) expect(can(gestor, mod, action), `${mod}:${action}`).toBe(false);
    }
    for (const mod of ["leads", "clientes", "propostas", "contratos", "projetos", "tarefas", "agenda", "conteudo", "marca", "arquivos", "equipe"] as const) {
      expect(canEverywhere(gestor, mod, "ver")).toBe(true);
      expect(canEverywhere(gestor, mod, "editar")).toBe(true);
    }
    // não exclui registros com histórico
    for (const mod of ["clientes", "contratos", "projetos", "equipe"] as const) expect(can(gestor, mod, "excluir")).toBe(false);
  });

  it("funcionário: nunca o módulo inteiro; sem comercial, sem financeiro, sem excluir nem compartilhar", () => {
    const funcionario = { role: "funcionario" } as const;
    for (const mod of MODULES) for (const action of ACTIONS) expect(canEverywhere(funcionario, mod, action), `${mod}:${action}`).toBe(false);
    for (const mod of ["leads", "clientes", "propostas", "contratos", "financeiro", "societario", "equipe", "site", "relatorios", "usuarios", "config", "auditoria", "dados"] as const) {
      for (const action of ACTIONS) expect(can(funcionario, mod, action), `${mod}:${action}`).toBe(false);
    }
    for (const mod of MODULES) {
      expect(can(funcionario, mod, "excluir")).toBe(false);
      expect(can(funcionario, mod, "compartilhar")).toBe(false);
    }
    for (const mod of ["projetos", "tarefas", "agenda", "conteudo", "arquivos"] as const) {
      expect(permissionScope(funcionario, mod, "ver")).toBe("projetos");
      expect(permissionScope(funcionario, mod, "editar")).toBe("projetos");
    }
  });
});

describe("ajustes individuais (concessões e negações)", () => {
  it("concessão dá a ação no módulo inteiro, mesmo que o perfil não tenha", () => {
    const gestor = { role: "gestor", permissions: overrides(["financeiro:ver"]) } as const;
    expect(permissionScope(gestor, "financeiro", "ver")).toBe("todos");
    expect(can(gestor, "financeiro", "editar")).toBe(false); // só o que foi concedido
    expect(can(gestor, "config", "ver")).toBe(false); // e só naquele módulo
  });

  it("conceder editar/baixar/excluir traz junto o ver do módulo (não há ação sem enxergar)", () => {
    const gestor = { role: "gestor", permissions: overrides(["relatorios:baixar"]) } as const;
    expect(rowOf(gestor, "relatorios")).toBe("T--T-");
  });

  it("negação tira a ação que o perfil tinha", () => {
    const gestor = { role: "gestor", permissions: overrides([], ["leads:excluir", "clientes:editar"]) } as const;
    expect(rowOf(gestor, "leads")).toBe("TT-TT");
    expect(rowOf(gestor, "clientes")).toBe("T--TT");
    expect(rowOf(gestor, "propostas")).toBe(EXPECTED.gestor.propostas); // o resto não muda
  });

  it("NEGAÇÃO VENCE CONCESSÃO", () => {
    const gestor = { role: "gestor", permissions: overrides(["financeiro:ver", "financeiro:editar"], ["financeiro:editar"]) } as const;
    expect(can(gestor, "financeiro", "ver")).toBe(true);
    expect(can(gestor, "financeiro", "editar")).toBe(false);
    const both = { role: "tecnico", permissions: overrides(["leads:ver"], ["leads:ver"]) } as const;
    expect(can(both, "leads", "ver")).toBe(false);
  });

  it("negar o VER de um módulo tira todas as ações dele, mesmo as concedidas", () => {
    const tecnico = { role: "tecnico", permissions: overrides(["financeiro:editar"], ["financeiro:ver"]) } as const;
    expect(rowOf(tecnico, "financeiro")).toBe("-----");
    expect(rowOf(tecnico, "leads")).toBe("TTTTT");
  });

  it("admin e sócio não são rebaixados por ajuste: negações são ignoradas", () => {
    const everything = MODULES.flatMap((mod) => ACTIONS.map((action) => `${mod}:${action}` as PermissionKey));
    for (const role of ["admin", "socio"] as const) {
      const subject = { role, permissions: overrides([], everything) };
      for (const mod of MODULES) for (const action of ACTIONS) expect(permissionScope(subject, mod, action)).toBe("todos");
    }
  });

  it("freelancer e cliente continuam sem nada no painel, mesmo com concessões gravadas", () => {
    const everything = MODULES.flatMap((mod) => ACTIONS.map((action) => `${mod}:${action}` as PermissionKey));
    for (const role of ["freelancer", "cliente"] as const) {
      const subject = { role, permissions: overrides(everything) };
      for (const mod of MODULES) for (const action of ACTIONS) expect(can(subject, mod, action)).toBe(false);
    }
  });

  it("módulos reservados (usuários, societário) não são concedidos por ajuste — nem se o JSON for adulterado", () => {
    for (const role of ["gestor", "tecnico", "funcionario"] as const) {
      const subject = { role, permissions: overrides(["usuarios:editar", "usuarios:ver", "societario:ver"]) };
      expect(can(subject, "usuarios", "ver")).toBe(false);
      expect(can(subject, "usuarios", "editar")).toBe(false);
      expect(can(subject, "societario", "ver")).toBe(false);
    }
  });

  it("concessão a um funcionário vale no módulo inteiro; o resto continua por projeto", () => {
    const funcionario = { role: "funcionario", permissions: overrides(["clientes:ver"]) } as const;
    expect(permissionScope(funcionario, "clientes", "ver")).toBe("todos");
    expect(permissionScope(funcionario, "tarefas", "ver")).toBe("projetos");
    expect(can(funcionario, "financeiro", "ver")).toBe(false);
  });

  it("a tabela efetiva reflete os ajustes", () => {
    const table = permissionTable({ role: "gestor", permissions: overrides(["dados:baixar"], ["leads:excluir"]) });
    expect(table.dados).toEqual({ ver: "todos", editar: null, excluir: null, baixar: "todos", compartilhar: null });
    expect(table.leads.excluir).toBeNull();
    expect(table.financeiro).toEqual({ ver: null, editar: null, excluir: null, baixar: null, compartilhar: null });
  });
});

describe("validação dos ajustes", () => {
  it("chaves válidas são modulo:acao conhecidos", () => {
    expect(isPermissionKey("financeiro:ver")).toBe(true);
    for (const bad of ["financeiro", "financeiro:", ":ver", "financeiro:apagar", "inexistente:ver", "financeiro:ver:x", "", 3, null, undefined, {}]) {
      expect(isPermissionKey(bad), String(bad)).toBe(false);
    }
  });

  it("ao gravar (zod estrito): recusa chave desconhecida e campo a mais; remove repetidas", () => {
    expect(permissionOverridesSchema.safeParse({ grant: ["financeiro:ver"], deny: [] }).success).toBe(true);
    expect(permissionOverridesSchema.safeParse({ grant: ["financeiro:tudo"], deny: [] }).success).toBe(false);
    expect(permissionOverridesSchema.safeParse({ grant: [], deny: [], role: "admin" }).success).toBe(false);
    expect(permissionOverridesSchema.safeParse({ grant: "financeiro:ver", deny: [] }).success).toBe(false);
    expect(permissionOverridesSchema.safeParse({ grant: [] }).success).toBe(false);
    expect(permissionOverridesSchema.parse({ grant: ["leads:ver", "leads:ver", "agenda:ver"], deny: [] }).grant).toEqual(["agenda:ver", "leads:ver"]);
  });

  it("ao ler do banco (tolerante): lixo vira 'sem ajustes' e chave desconhecida é ignorada — nunca um erro", () => {
    for (const garbage of [null, undefined, "x", 7, [], { grant: "tudo" }, { deny: 3 }]) expect(parseOverrides(garbage)).toEqual({ grant: [], deny: [] });
    expect(parseOverrides({ grant: ["financeiro:ver", "root:tudo", 9], deny: ["leads:excluir", "leads:excluir"] })).toEqual({
      grant: ["financeiro:ver"],
      deny: ["leads:excluir"],
    });
  });

  it("quem pode receber ajustes", () => {
    const some = overrides(["financeiro:ver"], ["leads:excluir"]);
    expect(overridesProblem("gestor", some)).toBeNull();
    expect(overridesProblem("tecnico", some)).toBeNull();
    expect(overridesProblem("funcionario", some)).toBeNull();
    // limpar os ajustes é sempre permitido
    for (const role of USER_ROLES) expect(overridesProblem(role, overrides())).toBeNull();
    // admin e sócio não recebem ajustes (não podem ser rebaixados por baixo do pano)
    expect(overridesProblem("admin", overrides([], ["usuarios:editar"]))).toMatch(/acesso total/);
    expect(overridesProblem("socio", some)).toMatch(/acesso total/);
    // perfis externos não usam o painel
    expect(overridesProblem("freelancer", some)).toMatch(/não usa o painel/);
    expect(overridesProblem("cliente", some)).toMatch(/não usa o painel/);
    // módulos reservados
    expect(overridesProblem("gestor", overrides(["usuarios:editar"]))).toMatch(/exclusivo de administradores/);
    expect(overridesProblem("tecnico", overrides(["societario:ver"]))).toMatch(/exclusivo de administradores/);
    // negar um módulo reservado a quem já não o tem é inofensivo
    expect(overridesProblem("gestor", overrides([], ["usuarios:ver"]))).toBeNull();
  });
});
