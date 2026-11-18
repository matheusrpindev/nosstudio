import { describe, expect, it } from "vitest";
import { unsentMailLog } from "./mail";

const reset = {
  to: "pedro@nosstudio.com.br",
  subject: "Redefinição de senha — painel NÓS Studio",
  text: "Olá!\n\nhttps://nosstudio.com.br/redefinir-senha?token=SEGREDO-DO-TOKEN\n",
};
const lead = {
  to: ["pedro@nosstudio.com.br", "laura@nosstudio.com.br"],
  subject: "Novo contato pelo site: Maria da Silva",
  text: "Nome: Maria da Silva\nWhatsApp: 11988887777\nE-mail: maria@exemplo.org\n\nMensagem:\nQuero um orçamento.",
};

describe("log de e-mail não enviado (sem SMTP)", () => {
  it("em produção não grava o corpo, o token, o nome do lead nem o endereço inteiro", () => {
    const resetLine = unsentMailLog(reset, true);
    expect(resetLine).not.toContain("SEGREDO-DO-TOKEN");
    expect(resetLine).not.toContain("redefinir-senha");
    expect(resetLine).not.toContain("pedro@");
    expect(resetLine).toContain("pe***@nosstudio.com.br");
    expect(resetLine).toContain("Redefinição de senha");
    expect(resetLine.split("\n")).toHaveLength(1);

    const leadLine = unsentMailLog(lead, true);
    for (const secret of ["Maria", "11988887777", "maria@exemplo.org", "orçamento", "laura@"]) expect(leadLine).not.toContain(secret);
    expect(leadLine).toContain("Novo contato pelo site");
    expect(leadLine.split("\n")).toHaveLength(1);
  });

  it("em desenvolvimento mostra o e-mail completo (para testar sem servidor de e-mail)", () => {
    const text = unsentMailLog(reset, false);
    expect(text).toContain("SEGREDO-DO-TOKEN");
    expect(text).toContain("pedro@nosstudio.com.br");
  });
});
