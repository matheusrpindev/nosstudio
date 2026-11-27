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
  /** Idem para os termos de uso e a política de cookies. */
  termsIsBaseText: boolean;
  cookiesIsBaseText: boolean;
  /** A seção "Sobre a NÓS" nunca foi salva no painel: as biografias ainda são as do briefing, sem validação. */
  biosUnreviewed: boolean;
  /** Planos mensais (visíveis) e quantos têm entregas cadastradas. */
  visiblePlans: number;
  plansWithIncludes: number;
  /** Serviços publicados e quantos ainda não têm descrição. */
  visibleServices: number;
  servicesWithoutDescription: number;
  /** Planos e avulsos (visíveis) que já têm valor publicado. */
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
      title: "Foto dos dois juntos não enviada",
      description: "É a foto de Pedro e Laura juntos, usada na abertura da página Sobre a NÓS.",
      href: "/painel/site/textos/about#bloco-abertura",
      actionLabel: "Enviar foto",
    });
  }

  if (s.biosUnreviewed) {
    out.push({
      id: "bios",
      tone: "alerta",
      title: "Biografias a validar",
      description:
        "A abertura, as bios de Pedro e Laura e a missão, visão e valores vieram do briefing. Confiram datas, cargos e experiências antes de divulgar. Ao revisar, salvem a seção (mesmo sem mudar nada) e este aviso some.",
      href: "/painel/site/textos/about#bloco-fundadores",
      actionLabel: "Revisar biografias",
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

  if (s.termsIsBaseText) {
    out.push({
      id: "terms",
      tone: "alerta",
      title: "Termos de uso ainda no texto-base",
      description: "O texto é um ponto de partida, sem dados da empresa (razão social, CNPJ, foro). Precisa de revisão jurídica antes de divulgar o site.",
      href: "/painel/site/textos/termsPage",
      actionLabel: "Revisar termos",
    });
  }

  if (s.cookiesIsBaseText) {
    out.push({
      id: "cookies",
      tone: "alerta",
      title: "Política de cookies ainda no texto-base",
      description:
        "Descreve o que o site usa hoje (nenhum cookie de rastreamento; só os do login). Precisa de revisão jurídica — e de atualização se um dia forem ligadas estatísticas ou publicidade.",
      href: "/painel/site/textos/cookiesPage",
      actionLabel: "Revisar cookies",
    });
  }

  if (s.visibleServices > 0 && s.servicesWithoutDescription > 0) {
    out.push({
      id: "services-descriptions",
      tone: "info",
      title: s.servicesWithoutDescription === 1 ? "Um serviço ainda sem descrição" : `${s.servicesWithoutDescription} serviços ainda sem descrição`,
      description:
        "O briefing trouxe o nome e as entregas de cada serviço. Descrição, benefícios, perguntas e fotos são escritos por vocês: enquanto estiverem vazios, esses blocos não aparecem na página do serviço.",
      href: "/painel/site/servicos",
      actionLabel: "Completar serviços",
    });
  }

  if (s.visiblePlans > 0 && s.plansWithIncludes < s.visiblePlans) {
    out.push({
      id: "plans-includes",
      tone: "info",
      title: "Planos sem entregas cadastradas",
      description: "A tabela comparativa é montada com o campo “O que inclui” de cada plano. Plano sem entregas aparece vazio na comparação.",
      href: "/painel/site/pacotes",
      actionLabel: "Ver planos",
    });
  }

  if (s.visiblePackages > 0 && s.packagesWithPrice === 0) {
    out.push({
      id: "packages-prices",
      tone: "info",
      title: "Planos sem valores publicados",
      description:
        "Tudo bem: o combinado é não publicar preços nem quantidades até validar custos, capacidade e margem. Enquanto isso o site mostra “Investimento personalizado para o seu negócio.”. Quando quiserem, é só preencher em Planos.",
      href: "/painel/site/pacotes",
      actionLabel: "Ver planos",
    });
  }

  return out;
}
