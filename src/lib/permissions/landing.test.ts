import { describe, expect, it } from "vitest";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { ENVIRONMENT_PATHS, ENVIRONMENT_READY, ENVIRONMENTS, environmentsOf, hasEnvironment, isExternalRole, RESTRICTED_PANEL_READY, type Environment } from "./environments";
import { availableEnvironments, canEnterNow, landingFor, LEGACY_PANEL_MODULES, panelAccess, type Readiness } from "./landing";
import type { PermissionKey } from "./matrix";

const ALL_READY: Readiness = { environments: { painel: true, equipe: true, cliente: true }, restrictedPanel: true };
const deny = (...keys: PermissionKey[]) => ({ grant: [], deny: keys });

describe("ambientes por perfil", () => {
  it("quem entra onde (tabela inteira)", () => {
    const expected: Record<UserRole, Environment[]> = {
      admin: ["painel"],
      socio: ["painel"],
      gestor: ["painel"],
      tecnico: ["painel"],
      funcionario: ["equipe", "painel"],
      freelancer: ["equipe"],
      cliente: ["cliente"],
    };
    for (const role of USER_ROLES) {
      expect([...environmentsOf(role)], role).toEqual(expected[role]);
      for (const environment of ENVIRONMENTS) expect(hasEnvironment(role, environment)).toBe(expected[role].includes(environment));
    }
  });

  it("freelancer e cliente são externos: nunca o painel", () => {
    expect(USER_ROLES.filter(isExternalRole)).toEqual(["freelancer", "cliente"]);
  });

  it("cliente só entra na Área do Cliente; freelancer só na Área da Equipe", () => {
    expect([...environmentsOf("cliente")]).toEqual(["cliente"]);
    expect([...environmentsOf("freelancer")]).toEqual(["equipe"]);
  });
});

describe("acesso ao painel: integral × restrito", () => {
  it("admin, sócio e técnico: integral (as telas atuais valem para eles)", () => {
    for (const role of ["admin", "socio", "tecnico"] as const) expect(panelAccess({ role })).toBe("integral");
  });

  it("gestor e funcionário: restrito (não podem ver todos os módulos das telas atuais)", () => {
    expect(panelAccess({ role: "gestor" })).toBe("restrito");
    expect(panelAccess({ role: "funcionario" })).toBe("restrito");
  });

  it("freelancer e cliente: sem painel", () => {
    expect(panelAccess({ role: "freelancer" })).toBeNull();
    expect(panelAccess({ role: "cliente" })).toBeNull();
  });

  it("um técnico com qualquer módulo das telas atuais negado deixa de ser integral", () => {
    for (const mod of LEGACY_PANEL_MODULES) {
      expect(panelAccess({ role: "tecnico", permissions: deny(`${mod}:ver`) }), mod).toBe("restrito");
    }
    // negar só uma ação que não é "ver" não tira a visão das telas
    expect(panelAccess({ role: "tecnico", permissions: deny("leads:excluir") })).toBe("integral");
  });

  it("um gestor só vira integral se receber o VER de tudo o que falta", () => {
    expect(panelAccess({ role: "gestor", permissions: { grant: ["financeiro:ver"], deny: [] } })).toBe("restrito");
    expect(panelAccess({ role: "gestor", permissions: { grant: ["financeiro:ver", "site:ver", "config:ver"], deny: [] } })).toBe("integral");
  });

  it("negações não rebaixam admin nem sócio", () => {
    expect(panelAccess({ role: "admin", permissions: deny("financeiro:ver", "usuarios:ver") })).toBe("integral");
    expect(panelAccess({ role: "socio", permissions: deny("leads:ver") })).toBe("integral");
  });
});

describe("destino depois do login", () => {
  it("HOJE: só o painel existe — inteiro e restrito; Área da Equipe e Área do Cliente ainda não", () => {
    expect(ENVIRONMENT_READY).toEqual({ painel: true, equipe: false, cliente: false });
    expect(RESTRICTED_PANEL_READY).toBe(true);
  });

  it("HOJE: admin, sócio e técnico vão para /painel", () => {
    for (const role of ["admin", "socio", "tecnico"] as const) {
      expect(landingFor({ role })).toEqual({ ok: true, environment: "painel", path: "/painel" });
    }
  });

  it("HOJE: gestor e funcionário entram no painel RESTRITO (o funcionário, enquanto a Área da Equipe não abre)", () => {
    for (const role of ["gestor", "funcionario"] as const) {
      expect(panelAccess({ role }), role).toBe("restrito");
      expect(landingFor({ role }), role).toEqual({ ok: true, environment: "painel", path: "/painel" });
      expect(availableEnvironments({ role })).toEqual(["painel"]);
    }
  });

  it("HOJE: freelancer e cliente não têm para onde ir — resposta clara, nunca o painel", () => {
    for (const role of ["freelancer", "cliente"] as const) {
      const landing = landingFor({ role });
      expect(landing.ok, role).toBe(false);
      if (!landing.ok) expect(landing.message).toMatch(/ainda não foi liberado/);
      expect(availableEnvironments({ role })).toEqual([]);
      expect(canEnterNow({ role }, "painel")).toBe(false);
    }
    const freelancer = landingFor({ role: "freelancer" });
    if (!freelancer.ok) expect(freelancer.message).toContain("Área da Equipe");
    const cliente = landingFor({ role: "cliente" });
    if (!cliente.ok) expect(cliente.message).toContain("Área do Cliente");
  });

  it("HOJE: técnico com negação individual vira restrito e continua entrando (só perde o que foi negado)", () => {
    expect(landingFor({ role: "tecnico", permissions: deny("financeiro:ver") })).toEqual({ ok: true, environment: "painel", path: "/painel" });
  });

  it("FREIO: com o painel restrito fechado, gestor, funcionário e técnico com negação voltam a ficar de fora", () => {
    const closed: Readiness = { environments: ENVIRONMENT_READY, restrictedPanel: false };
    for (const role of ["gestor", "funcionario"] as const) {
      const landing = landingFor({ role }, closed);
      expect(landing.ok, role).toBe(false);
      if (!landing.ok) expect(landing.message).toMatch(/ainda não foi liberado/);
      expect(canEnterNow({ role }, "painel", closed)).toBe(false);
    }
    expect(landingFor({ role: "tecnico", permissions: deny("financeiro:ver") }, closed).ok).toBe(false);
    expect(landingFor({ role: "admin" }, closed).ok).toBe(true);
  });

  it("QUANDO TUDO EXISTIR: cada perfil cai no seu ambiente; o funcionário começa pela Área da Equipe", () => {
    const expected: Record<UserRole, Environment> = {
      admin: "painel",
      socio: "painel",
      gestor: "painel",
      tecnico: "painel",
      funcionario: "equipe",
      freelancer: "equipe",
      cliente: "cliente",
    };
    for (const role of USER_ROLES) {
      expect(landingFor({ role }, ALL_READY), role).toEqual({ ok: true, environment: expected[role], path: ENVIRONMENT_PATHS[expected[role]] });
    }
    expect(availableEnvironments({ role: "funcionario" }, ALL_READY)).toEqual(["equipe", "painel"]);
  });

  it("mesmo com tudo pronto, ninguém entra em ambiente que não é do perfil", () => {
    for (const role of ["freelancer", "cliente"] as const) expect(canEnterNow({ role }, "painel", ALL_READY)).toBe(false);
    for (const role of ["admin", "socio", "gestor", "tecnico", "funcionario", "freelancer"] as const) expect(canEnterNow({ role }, "cliente", ALL_READY)).toBe(false);
    for (const role of ["admin", "socio", "gestor", "tecnico", "cliente"] as const) expect(canEnterNow({ role }, "equipe", ALL_READY)).toBe(false);
  });

  it("Área da Equipe pronta, painel restrito não: o funcionário vai para a equipe e o gestor segue esperando", () => {
    const readiness: Readiness = { environments: { painel: true, equipe: true, cliente: false }, restrictedPanel: false };
    expect(landingFor({ role: "funcionario" }, readiness)).toEqual({ ok: true, environment: "equipe", path: "/equipe" });
    expect(availableEnvironments({ role: "funcionario" }, readiness)).toEqual(["equipe"]);
    expect(landingFor({ role: "gestor" }, readiness).ok).toBe(false);
    expect(landingFor({ role: "cliente" }, readiness).ok).toBe(false);
  });
});
