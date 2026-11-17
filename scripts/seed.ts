/**
 * Carga inicial do banco (idempotente: pode rodar várias vezes; só preenche tabelas vazias).
 *
 *   npm run db:seed              conteúdo inicial do site (serviços, pacotes, FAQ, avisos, modelos de proposta)
 *   npm run db:seed -- --dev     + duas contas de desenvolvimento (NUNCA em produção)
 *   npm run db:seed -- --demo    + dados de exemplo no painel, marcados como [Exemplo] (para testar os fluxos)
 *
 * Os textos fixos das páginas (hero, Quem Somos, etc.) não são gravados aqui: enquanto ninguém editar,
 * o site usa os padrões de src/lib/site/content.ts.
 */
import { count, eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import {
  agendaEvents,
  announcements,
  brandAssets,
  clientInteractions,
  clients,
  contentItems,
  contracts,
  faqs,
  financeEntries,
  leads,
  packages,
  projects,
  proposalItems,
  proposalPayments,
  proposals,
  services,
  tasks,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { addDays, todayISO } from "@/lib/dates";

const args = new Set(process.argv.slice(2));
const isProd = process.env.NODE_ENV === "production";

async function isEmpty(table: SQLiteTable) {
  const [row] = await db.select({ n: count() }).from(table);
  return row.n === 0;
}

// ---------------------------------------------------------------- serviços
async function seedServices() {
  if (!(await isEmpty(services))) return false;
  await db.insert(services).values([
    {
      slug: "fotografia",
      title: "Fotografia",
      summary: "Ensaios, fotos para marcas e produtos, fotografia de eventos e cobertura social.",
      items: [
        "Ensaios individuais e profissionais",
        "Fotografia corporativa",
        "Fotografia de produtos",
        "Cobertura fotográfica de eventos",
        "Casamentos e pré-wedding",
      ],
      ctaLabel: "Quero fotos",
      interest: "fotografia",
      sortOrder: 1,
    },
    {
      slug: "video",
      title: "Vídeo e produção audiovisual",
      summary: "Roteiro, captação, reels, vídeos institucionais, edição e pós-produção.",
      items: [
        "Vídeos institucionais",
        "Reels e vídeos para redes sociais",
        "Produção de campanhas",
        "Vídeos promocionais",
        "Captação e edição audiovisual",
        "Vídeos para profissionais e influenciadores",
      ],
      ctaLabel: "Quero vídeo",
      interest: "video",
      sortOrder: 2,
    },
    {
      slug: "marketing",
      title: "Marketing e redes sociais",
      summary: "Planejamento, calendário, gestão de conteúdo e acompanhamento de resultados.",
      items: [
        "Gestão de redes sociais",
        "Planejamento estratégico",
        "Calendário editorial",
        "Criação de conteúdos",
        "Roteiros e legendas",
        "Posicionamento e comunicação digital",
        "Acompanhamento de resultados",
      ],
      ctaLabel: "Quero presença digital",
      interest: "marketing",
      sortOrder: 3,
    },
    {
      slug: "eventos",
      title: "Eventos",
      summary: "Foto, filme, storymaker e conteúdo em tempo real para eventos empresariais e sociais.",
      items: [
        "Cobertura fotográfica",
        "Filmagem profissional",
        "Storymaker",
        "Conteúdo em tempo real",
        "Vídeo de melhores momentos",
        "Cobertura para eventos empresariais e sociais",
      ],
      ctaLabel: "Quero cobrir meu evento",
      interest: "eventos",
      sortOrder: 4,
    },
    {
      slug: "casamentos",
      title: "Casamentos",
      summary: "Pré-wedding, making of, fotografia e filme, com proposta específica para cada casal.",
      items: [
        "Fotografia do casamento",
        "Filme cinematográfico",
        "Making of dos noivos",
        "Ensaio pré-wedding",
        "Teaser vertical",
        "Filme de melhores momentos",
        "Galeria digital",
      ],
      ctaLabel: "Pedir proposta de casamento",
      interest: "casamentos",
      pagePath: "/casamentos",
      sortOrder: 5,
    },
  ]);
  return true;
}

// ------------------------------------------------------------------ pacotes
async function seedPackages() {
  if (!(await isEmpty(packages))) return false;
  // Quantidades, limites e preços ainda serão fechados pelos sócios: tudo "Sob consulta", sem promessas.
  await db.insert(packages).values([
    {
      kind: "plano",
      name: "Começo",
      tagline: "Para marcas que precisam começar a se comunicar com consistência.",
      description: "Foco em organizar a presença digital, criar conteúdo e estabelecer uma comunicação profissional.",
      sortOrder: 1,
    },
    {
      kind: "plano",
      name: "Presença",
      tagline: "Para marcas que querem estar presentes de verdade.",
      description:
        "Foco em produção recorrente de conteúdo, planejamento de comunicação e fortalecimento do relacionamento com o público.",
      recommended: true,
      sortOrder: 2,
    },
    {
      kind: "plano",
      name: "Destaque",
      tagline: "Para marcas que querem ampliar sua presença e desenvolver uma comunicação mais completa.",
      description:
        "Foco em maior volume de produção, acompanhamento estratégico e integração entre marketing e audiovisual.",
      sortOrder: 3,
    },
    { kind: "avulso", name: "Diária de fotógrafo", sortOrder: 10 },
    { kind: "avulso", name: "Diária de filmmaker", sortOrder: 11 },
    { kind: "avulso", name: "Cobertura de eventos", sortOrder: 12 },
    { kind: "avulso", name: "Storymaker", sortOrder: 13 },
    { kind: "avulso", name: "Produção e edição de vídeos", sortOrder: 14 },
    { kind: "avulso", name: "Projetos personalizados", sortOrder: 15 },
  ]);
  return true;
}

// ---------------------------------------------------------------------- FAQ
async function seedFaqs() {
  if (!(await isEmpty(faqs))) return false;
  // Todas entram como RASCUNHO (published: false). As respostas sugeridas vêm só do que o briefing já afirma;
  // as que dependem de condições comerciais/contratuais ficam em branco para os sócios preencherem.
  const items: { question: string; answer?: string; showOnHome?: boolean; showOnWeddings?: boolean }[] = [
    {
      question: "Como solicitar um orçamento?",
      answer:
        "É só preencher o formulário da página de contato ou chamar a gente no WhatsApp. Conte sua ideia, o que você precisa e para quando: a partir daí conversamos, entendemos o projeto e enviamos uma proposta personalizada.",
      showOnHome: true,
    },
    {
      question: "Vocês atendem empresas e pessoas físicas?",
      answer:
        "Sim. Atendemos empresas construindo sua marca, profissionais que querem mostrar seu trabalho e pessoas vivendo momentos importantes, como casamentos e eventos.",
      showOnHome: true,
    },
    {
      question: "É possível contratar apenas uma gravação?",
      answer:
        "Sim. Além dos planos mensais, trabalhamos com serviços avulsos, como diária de fotógrafo, diária de filmmaker, storymaker, cobertura de eventos e projetos personalizados.",
      showOnHome: true,
    },
    {
      question: "Vocês trabalham com pacotes mensais?",
      answer:
        "Sim. Temos os planos Começo, Presença e Destaque, pensados para diferentes momentos de cada marca. As entregas de cada plano são definidas em proposta.",
      showOnHome: true,
    },
    {
      question: "Fazem cobertura de casamentos e eventos?",
      answer:
        "Sim. Fazemos fotografia e filmagem de casamentos, incluindo making of, ensaio pré-wedding e filme de melhores momentos, e cobertura de eventos empresariais e sociais.",
      showOnWeddings: true,
    },
    { question: "Como funciona o pagamento?", showOnWeddings: true },
    { question: "Qual é o prazo de entrega?", showOnWeddings: true },
    { question: "Posso solicitar alterações no material?" },
    { question: "Como funciona o cancelamento?", showOnWeddings: true },
    {
      question: "Os arquivos são entregues por link?",
      answer: "Sim. Os materiais finais são entregues por link, em galeria digital ou pasta compartilhada.",
      showOnWeddings: true,
    },
    { question: "Vocês atendem fora da cidade?", showOnWeddings: true },
  ];
  await db.insert(faqs).values(
    items.map((item, index) => ({
      question: item.question,
      answer: item.answer ?? "",
      published: false,
      showOnHome: item.showOnHome ?? false,
      showOnWeddings: item.showOnWeddings ?? false,
      sortOrder: index + 1,
    })),
  );
  return true;
}

// ------------------------------------------------------------------- avisos
async function seedAnnouncements() {
  if (!(await isEmpty(announcements))) return false;
  await db.insert(announcements).values([
    {
      message: "Chegou a NÓS Studio. Dois olhares, infinitas possibilidades.",
      linkLabel: "Vamos conversar",
      linkUrl: "/contato",
      bgColor: "roxo",
      textColor: "branco",
      enabled: true,
      sortOrder: 1,
    },
    {
      message: "Sua próxima grande ideia começa com NÓS. Solicite um orçamento.",
      linkLabel: "Solicitar orçamento",
      linkUrl: "/contato",
      bgColor: "lima",
      textColor: "grafite",
      enabled: false,
      sortOrder: 2,
    },
    {
      message: "Vamos eternizar a sua história? Conheça nossas coberturas de casamento.",
      linkLabel: "Ver casamentos",
      linkUrl: "/casamentos",
      bgColor: "lavanda",
      textColor: "roxo",
      enabled: false,
      sortOrder: 3,
    },
  ]);
  return true;
}

// ------------------------------------------------------ modelos de proposta
async function seedProposalTemplates() {
  if (!(await isEmpty(proposals))) return false;

  // Modelo de casamento — exemplo já definido pelos sócios (R$ 10.900,00; entrada de 30%).
  const [wedding] = await db
    .insert(proposals)
    .values({
      number: "MODELO-CASAMENTO",
      isTemplate: true,
      templateName: "Casamento — cobertura completa",
      modality: "casamento",
      title: "Cobertura de casamento",
      intro:
        "Cobertura completa de fotografia e filme do casamento, do making of à festa, para registrar os momentos espontâneos e contar a história do casal com sensibilidade.",
      scheduleText: "8 horas de cobertura no dia do casamento, com 2 fotógrafos e 2 filmmakers.",
      entryMode: "percentual",
      entryPercent: 30,
      entryCents: 327000,
    })
    .returning({ id: proposals.id });
  await db.insert(proposalItems).values(
    [
      { title: "Cobertura de casamento", description: "8 horas de cobertura", quantity: 1, unit: "", unitPriceCents: 1090000 },
      { title: "Fotógrafos", description: "", quantity: 2, unit: "profissionais" },
      { title: "Filmmakers", description: "", quantity: 2, unit: "profissionais" },
      { title: "Making of", description: "Bastidores e preparação dos noivos" },
      { title: "Ensaio pré-wedding", description: "Incluso, sem cobrança adicional" },
      { title: "Fotografias digitais", description: "" },
      { title: "Filme de melhores momentos", description: "" },
      { title: "Teaser vertical", description: "Vídeo curto no formato das redes sociais" },
      { title: "Galeria digital", description: "Entrega das fotos por link" },
    ].map((item, index) => ({
      proposalId: wedding.id,
      kind: "incluso" as const,
      title: item.title,
      description: item.description,
      quantity: item.quantity ?? 1,
      unit: item.unit ?? "",
      unitPriceCents: item.unitPriceCents ?? 0,
      sortOrder: index + 1,
    })),
  );
  await db.insert(proposalPayments).values([
    { proposalId: wedding.id, label: "Entrada (30%)", dueLabel: "", amountCents: 327000, sortOrder: 1 },
    { proposalId: wedding.id, label: "Saldo restante", dueLabel: "condições a definir", amountCents: 763000, sortOrder: 2 },
  ]);

  // Modelo mensal — estrutura para preencher (sem valores: as condições dos planos ainda serão fechadas).
  const [monthly] = await db
    .insert(proposals)
    .values({
      number: "MODELO-MENSAL",
      isTemplate: true,
      templateName: "Plano mensal — comunicação e conteúdo",
      modality: "mensal",
      title: "Plano mensal de comunicação e conteúdo",
      intro:
        "Produção recorrente de conteúdo, planejamento de comunicação e acompanhamento, para a marca estar presente de verdade.",
      scheduleText: "Contrato mensal, com planejamento, produção e entregas organizados mês a mês.",
    })
    .returning({ id: proposals.id });
  await db.insert(proposalItems).values(
    [
      "Planejamento estratégico e calendário editorial",
      "Criação de conteúdos, roteiros e legendas",
      "Captação de fotos e vídeos",
      "Edição de vídeos para redes sociais",
      "Gestão de redes sociais",
      "Acompanhamento de resultados",
    ].map((title, index) => ({ proposalId: monthly.id, kind: "incluso" as const, title, sortOrder: index + 1 })),
  );
  return true;
}

// ------------------------------------------------------- biblioteca da marca
async function seedBrandAssets() {
  if (!(await isEmpty(brandAssets))) return false;
  const logo = (file: string, title: string, sortOrder: number) => ({
    category: "logo" as const,
    title,
    url: `/brand/${file}`,
    description: "SVG vetorial",
    sortOrder,
  });
  await db.insert(brandAssets).values([
    logo("nos-studio-completo-roxo.svg", "Logo completo — roxo (fundos claros)", 1),
    logo("nos-studio-completo-branco.svg", "Logo completo — branco (fundos escuros)", 2),
    logo("nos-studio-completo-grafite.svg", "Logo completo — grafite (monocromático)", 3),
    logo("nos-studio-assinatura-roxo.svg", "Assinatura NÓS + STUDIO — roxo", 4),
    logo("nos-studio-assinatura-branco.svg", "Assinatura NÓS + STUDIO — branco", 5),
    logo("nos-studio-wordmark-roxo.svg", "Wordmark NÓS — roxo", 6),
    logo("nos-studio-wordmark-branco.svg", "Wordmark NÓS — branco", 7),
    logo("nos-studio-simbolo-roxo.svg", "Símbolo (Ó com play) — roxo", 8),
    logo("nos-studio-simbolo-branco.svg", "Símbolo (Ó com play) — branco", 9),
    {
      category: "paleta",
      title: "Paleta oficial",
      description: "Roxo #3B1F8E · Lima #C6F432 · Lavanda #CFC6FF · Off-white #F6F4EF · Grafite #1B1B22",
      sortOrder: 20,
    },
    {
      category: "fontes",
      title: "Montserrat",
      description: "Tipografia da marca (Google Fonts, licença aberta OFL).",
      url: "https://fonts.google.com/specimen/Montserrat",
      sortOrder: 30,
    },
  ]);
  return true;
}

// ----------------------------------------------------- contas de desenvolvimento
const DEV_PASSWORD = "nosstudio-dev-2026";
async function seedDevUsers() {
  if (isProd) throw new Error("--dev não pode ser usado em produção. Crie as contas com: npm run user:create");
  if (!(await isEmpty(users))) return false;
  const passwordHash = await hashPassword(DEV_PASSWORD);
  await db.insert(users).values([
    { name: "Pedro Henrique", email: "pedro@nos.local", passwordHash, role: "admin" },
    { name: "Laura Nepomuceno", email: "laura@nos.local", passwordHash, role: "admin" },
  ]);
  return true;
}

// ------------------------------------------------------------ dados de exemplo
async function seedDemo() {
  if (isProd && !args.has("--force")) throw new Error("--demo em produção exige --force (os dados são fictícios).");
  if (!(await isEmpty(clients))) return false;
  const today = todayISO();
  const [pedro, laura] = await db.select({ id: users.id }).from(users).orderBy(users.id).limit(2);
  const owner = (i: number) => (i % 2 === 0 ? pedro?.id : laura?.id) ?? null;

  const insertedClients = await db
    .insert(clients)
    .values([
      {
        name: "[Exemplo] Ana & Bruno",
        contactName: "Ana",
        kind: "pf",
        whatsapp: "11900000001",
        source: "site",
        serviceInterest: "casamentos",
        status: "negociacao",
        ownerId: owner(0),
        firstContactAt: addDays(today, -12),
        nextStep: "Enviar proposta revisada",
        nextStepDate: addDays(today, 2),
        importantDates: [{ label: "Casamento", date: addDays(today, 150) }],
      },
      {
        name: "[Exemplo] Café da Praça",
        contactName: "Marina",
        kind: "pj",
        whatsapp: "11900000002",
        email: "contato@exemplo.com.br",
        segment: "Cafeteria",
        source: "instagram",
        serviceInterest: "pacote_mensal",
        status: "em_producao",
        ownerId: owner(1),
        firstContactAt: addDays(today, -40),
      },
      {
        name: "[Exemplo] Dra. Camila",
        contactName: "Camila",
        kind: "pf",
        whatsapp: "11900000003",
        segment: "Odontologia",
        source: "indicacao",
        serviceInterest: "video",
        status: "em_orcamento",
        ownerId: owner(0),
        firstContactAt: addDays(today, -3),
        nextStep: "Montar orçamento de vídeos",
        nextStepDate: addDays(today, 1),
      },
    ])
    .returning({ id: clients.id });
  const [wedding, cafe, doctor] = insertedClients.map((c) => c.id);

  await db.insert(clientInteractions).values([
    { clientId: wedding, userId: owner(0), kind: "whatsapp", content: "Primeira conversa: casamento para 120 convidados." },
    { clientId: wedding, userId: owner(0), kind: "status", content: "Status: Em orçamento → Negociação" },
    { clientId: cafe, userId: owner(1), kind: "reuniao", content: "Reunião de alinhamento do calendário do mês." },
  ]);

  await db.insert(leads).values([
    {
      name: "[Exemplo] Juliana",
      whatsapp: "11900000004",
      serviceInterest: "eventos",
      eventDate: addDays(today, 45),
      city: "",
      message: "Aniversário de 15 anos, gostaria de foto e vídeo.",
      source: "site",
      originPath: "/contato",
      consentAt: new Date(),
      consentVersion: "2026-11",
    },
    {
      name: "[Exemplo] Loja Aurora",
      whatsapp: "11900000005",
      email: "aurora@exemplo.com.br",
      serviceInterest: "marketing",
      message: "Quero organizar o Instagram da loja.",
      source: "site",
      originPath: "/pacotes",
      consentAt: new Date(),
      consentVersion: "2026-11",
    },
  ]);

  // Proposta de casamento a partir do modelo (o exemplo definido no briefing).
  const [template] = await db.select().from(proposals).where(eq(proposals.number, "MODELO-CASAMENTO"));
  let proposalId: number | null = null;
  if (template) {
    const year = today.slice(0, 4);
    const [created] = await db
      .insert(proposals)
      .values({
        number: `${year}-001`,
        modality: "casamento",
        status: "enviada",
        clientId: wedding,
        clientDisplayName: "Ana & Bruno",
        contactName: "Ana",
        ownerId: owner(0),
        title: template.title,
        eventDate: addDays(today, 150),
        eventLocation: "",
        validUntil: addDays(today, 10),
        intro: template.intro,
        scheduleText: template.scheduleText,
        entryMode: "percentual",
        entryPercent: 30,
        entryCents: 327000,
        sentAt: new Date(),
        createdBy: owner(0),
      })
      .returning({ id: proposals.id });
    proposalId = created.id;
    const items = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, template.id));
    await db.insert(proposalItems).values(items.map(({ id: _id, ...item }) => ({ ...item, proposalId: created.id })));
    const payments = await db.select().from(proposalPayments).where(eq(proposalPayments.proposalId, template.id));
    await db.insert(proposalPayments).values(payments.map(({ id: _id, ...p }) => ({ ...p, proposalId: created.id })));
  }

  const [project] = await db
    .insert(projects)
    .values({
      clientId: cafe,
      title: "[Exemplo] Conteúdo mensal — Café da Praça",
      serviceType: "pacote_mensal",
      stage: "edicao",
      ownerId: owner(1),
      shootDeadline: addDays(today, -2),
      deliveryDeadline: addDays(today, 4),
      checklist: [
        { id: "a", text: "Roteiros aprovados", done: true },
        { id: "b", text: "Gravação na loja", done: true },
        { id: "c", text: "Edição dos reels", done: false },
      ],
    })
    .returning({ id: projects.id });

  await db.insert(tasks).values([
    { title: "[Exemplo] Enviar proposta revisada — Ana & Bruno", dueDate: addDays(today, 2), ownerId: owner(0), clientId: wedding, priority: "alta" },
    { title: "[Exemplo] Editar reels da semana", dueDate: addDays(today, 3), ownerId: owner(1), clientId: cafe, projectId: project.id },
    { title: "[Exemplo] Montar orçamento — Dra. Camila", dueDate: addDays(today, 1), ownerId: owner(0), clientId: doctor },
  ]);

  await db.insert(agendaEvents).values([
    { title: "[Exemplo] Gravação — Café da Praça", kind: "gravacao", date: addDays(today, 1), startTime: "09:00", endTime: "12:00", clientId: cafe, projectId: project.id, ownerId: owner(1) },
    { title: "[Exemplo] Reunião — Ana & Bruno", kind: "reuniao", date: addDays(today, 3), startTime: "19:30", endTime: "20:30", clientId: wedding, ownerId: owner(0) },
    { title: "[Exemplo] Entrega de edição — Café da Praça", kind: "entrega", date: addDays(today, 4), clientId: cafe, projectId: project.id, ownerId: owner(1) },
  ]);

  await db.insert(financeEntries).values([
    { type: "receita", category: "pacote_mensal", description: "[Exemplo] Mensalidade — Café da Praça", amountCents: 150000, dueDate: addDays(today, -5), paidAt: addDays(today, -4), method: "pix", clientId: cafe, projectId: project.id },
    { type: "receita", category: "servico", description: "[Exemplo] Entrada — casamento Ana & Bruno", amountCents: 327000, dueDate: addDays(today, 6), installmentLabel: "Entrada (30%)", clientId: wedding, proposalId },
    { type: "despesa", category: "freelancer", description: "[Exemplo] Editor freelancer", amountCents: 40000, dueDate: addDays(today, 5), supplier: "Freelancer" },
    { type: "despesa", category: "software", description: "[Exemplo] Assinatura de edição", amountCents: 9900, dueDate: addDays(today, -1), paidAt: addDays(today, -1), method: "cartao" },
  ]);

  await db.insert(contentItems).values([
    { title: "[Exemplo] Bastidores da gravação", clientId: null, network: "instagram", format: "reels", status: "edicao", ownerId: owner(1), publishDate: addDays(today, 3), editDeadline: addDays(today, 2) },
    { title: "[Exemplo] Quem somos: Pedro e Laura", clientId: null, network: "instagram", format: "carrossel", status: "roteiro", ownerId: owner(0), publishDate: addDays(today, 6) },
    { title: "[Exemplo] Novo cardápio de inverno", clientId: cafe, network: "instagram", format: "reels", status: "aprovacao", approvalStatus: "pendente", ownerId: owner(1), publishDate: addDays(today, 2) },
    { title: "[Exemplo] 3 erros ao gravar com o celular", clientId: null, network: "tiktok", format: "reels", status: "ideia", ownerId: owner(0) },
  ]);

  await db.insert(contracts).values([
    {
      title: "[Exemplo] Modelo — contrato de diária",
      kind: "diaria",
      isTemplate: true,
      versionLabel: "rascunho",
      body: "Modelo de exemplo. A redação jurídica precisa ser revisada antes do uso.\n\n**Objeto:** prestação de serviço de captação em diária…",
    },
  ]);
  return true;
}

// --------------------------------------------------------------------- main
async function main() {
  const steps: [string, () => Promise<boolean>][] = [
    ["serviços", seedServices],
    ["pacotes", seedPackages],
    ["perguntas frequentes (rascunhos)", seedFaqs],
    ["avisos", seedAnnouncements],
    ["modelos de proposta", seedProposalTemplates],
    ["biblioteca da marca", seedBrandAssets],
  ];
  if (args.has("--dev")) steps.push(["contas de desenvolvimento", seedDevUsers]);
  if (args.has("--demo")) steps.push(["dados de exemplo", seedDemo]);

  for (const [label, run] of steps) {
    const created = await run();
    console.log(`${created ? "✔ criado " : "· mantido"}  ${label}`);
  }
  if (args.has("--dev")) {
    console.log(`\nContas de desenvolvimento: pedro@nos.local e laura@nos.local — senha: ${DEV_PASSWORD}`);
  }
}

main().catch((error) => {
  console.error("✖ Falha no seed:", error);
  process.exit(1);
});
