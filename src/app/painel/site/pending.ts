/**
 * Pendências de lançamento do site, calculadas a partir de um retrato do estado atual.
 * Arquivo puro (sem banco): o retrato é montado em `overview.ts` e esta função é testada em `pending.test.ts`.
 */
export type LaunchSnapshot = {
  whatsapp: string;
  email: string;
  founders: { name: string; mediaId: number | null }[];
  coupleMediaId: number | null;
  publishedFaqs: number;
  /** O texto da política ainda é o texto-base e a versão não mudou. */
  privacyIsBaseText: boolean;
  /** Pacotes (visíveis) que já têm valor cadastrado. */
  packagesWithPrice: number;
  visiblePackages: number;
};

export type LaunchPending = {
  id: string;
  /** `alerta` impede um bom lançamento; `info` é um lembrete. */
  tone: "alerta" | "info";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
};

export function computeLaunchPending(s: LaunchSnapshot): LaunchPending[] {
  const out: LaunchPending[] = [];

  if (!s.whatsapp.trim()) {
    out.push({
      id: "whatsapp",
      tone: "alerta",
      title: "WhatsApp não configurado",
      description: "Enquanto não houver número, os botões de WhatsApp ficam ocultos no site. O formulário de contato continua funcionando.",
      href: "/painel/site/textos/general#bloco-whatsapp",
      actionLabel: "Cadastrar WhatsApp",
    });
  }

  if (!s.email.trim()) {
    out.push({
      id: "email",
      tone: "alerta",
      title: "E-mail de contato não configurado",
      description: "Ele aparece no rodapé e na política de privacidade (para pedidos dos titulares dos dados).",
      href: "/painel/site/textos/general#bloco-contato",
      actionLabel: "Cadastrar e-mail",
    });
  }

  const withoutPhoto = s.founders.filter((founder) => !founder.mediaId);
  if (withoutPhoto.length > 0) {
    const names = withoutPhoto.map((founder) => founder.name.split(" ")[0]).filter(Boolean);
    out.push({
      id: "founders-photos",
      tone: "alerta",
      title: withoutPhoto.length === 1 ? "Falta a foto de um fundador" : "Fotos dos fundadores não enviadas",
      description: `Sem foto${names.length ? ` (${names.join(", ")})` : ""}, o site mostra um espaço com as iniciais.`,
      href: "/painel/site/textos/about#bloco-fundadores",
      actionLabel: "Enviar fotos",
    });
  }

  if (!s.coupleMediaId) {
    out.push({
      id: "couple-photo",
      tone: "alerta",
      title: "Foto do casal não enviada",
      description: "É a foto de Pedro e Laura juntos, usada na página Quem Somos.",
      href: "/painel/site/textos/about#bloco-abertura",
      actionLabel: "Enviar foto",
    });
  }

  if (s.publishedFaqs === 0) {
    out.push({
      id: "faq",
      tone: "alerta",
      title: "Nenhuma pergunta frequente publicada",
      description: "O bloco de FAQ só aparece quando há ao menos uma pergunta publicada com resposta.",
      href: "/painel/site/faq",
      actionLabel: "Cadastrar perguntas",
    });
  }

  if (s.privacyIsBaseText) {
    out.push({
      id: "privacy",
      tone: "alerta",
      title: "Política de privacidade ainda no texto-base",
      description: "Revise com assessoria jurídica antes de divulgar o site. Ao revisar, atualize o texto e a versão.",
      href: "/painel/site/textos/privacyPage",
      actionLabel: "Revisar política",
    });
  }

  if (s.visiblePackages > 0 && s.packagesWithPrice === 0) {
    out.push({
      id: "packages-prices",
      tone: "info",
      title: "Pacotes sem valores cadastrados",
      description: "Tudo bem: o combinado é mostrar “Sob consulta” até vocês cadastrarem os valores. Quando quiserem, é só preencher em Pacotes.",
      href: "/painel/site/pacotes",
      actionLabel: "Ver pacotes",
    });
  }

  return out;
}
