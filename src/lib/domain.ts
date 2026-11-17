/**
 * Vocabulário de domínio da NÓS Studio: enums e rótulos em pt-BR.
 * Arquivo puro (sem dependências de servidor) — pode ser importado em Server e Client Components.
 * O schema do banco (src/db/schema.ts) importa as listas daqui: mude um status aqui e ele vale no sistema todo.
 */

function labels<const T extends readonly string[]>(_keys: T, map: Record<T[number], string>) {
  return map;
}

// ---------------------------------------------------------------- usuários
export const USER_ROLES = ["admin", "tecnico"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_ROLE_LABELS = labels(USER_ROLES, {
  admin: "Administrador(a)",
  tecnico: "Acesso técnico (temporário)",
});

// ------------------------------------------------------- paleta / aparência
/** Cores oficiais da marca. Usadas, por exemplo, na barra de avisos (fundo/texto). */
export const BRAND_COLORS = ["roxo", "lima", "lavanda", "offwhite", "grafite", "branco"] as const;
export type BrandColor = (typeof BRAND_COLORS)[number];
export const BRAND_COLOR_HEX: Record<BrandColor, string> = {
  roxo: "#3B1F8E",
  lima: "#C6F432",
  lavanda: "#CFC6FF",
  offwhite: "#F6F4EF",
  grafite: "#1B1B22",
  branco: "#FFFFFF",
};
export const BRAND_COLOR_LABELS = labels(BRAND_COLORS, {
  roxo: "Roxo",
  lima: "Lima",
  lavanda: "Lavanda",
  offwhite: "Off-white",
  grafite: "Grafite",
  branco: "Branco",
});

// ------------------------------------------------------------------ pacotes
export const PACKAGE_KINDS = ["plano", "avulso"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];
export const PACKAGE_KIND_LABELS = labels(PACKAGE_KINDS, {
  plano: "Plano mensal",
  avulso: "Serviço avulso",
});

export const PRICE_MODES = ["sob_consulta", "a_partir", "fixo"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];
export const PRICE_MODE_LABELS = labels(PRICE_MODES, {
  sob_consulta: "Sob consulta",
  a_partir: "A partir de",
  fixo: "Preço fixo",
});

// ---------------------------------------------------------------- portfólio
export const PORTFOLIO_CATEGORIES = ["marketing", "fotografia", "videos", "eventos", "casamentos"] as const;
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];
export const PORTFOLIO_CATEGORY_LABELS = labels(PORTFOLIO_CATEGORIES, {
  marketing: "Marketing e marcas",
  fotografia: "Fotografia",
  videos: "Vídeos",
  eventos: "Eventos",
  casamentos: "Casamentos",
});

// -------------------------------------------------------------- depoimentos
export const TESTIMONIAL_KINDS = ["texto", "print", "video"] as const;
export type TestimonialKind = (typeof TESTIMONIAL_KINDS)[number];
export const TESTIMONIAL_KIND_LABELS = labels(TESTIMONIAL_KINDS, {
  texto: "Depoimento escrito",
  print: "Print de conversa",
  video: "Vídeo",
});

// -------------------------------------------------------------------- leads
export const LEAD_STATUSES = ["novo", "em_atendimento", "convertido", "descartado"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS = labels(LEAD_STATUSES, {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  convertido: "Convertido em cliente",
  descartado: "Descartado",
});

export const CONTACT_SOURCES = ["site", "whatsapp", "instagram", "indicacao", "evento", "outro"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];
export const CONTACT_SOURCE_LABELS = labels(CONTACT_SOURCES, {
  site: "Site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  indicacao: "Indicação",
  evento: "Evento",
  outro: "Outro",
});

/** Opções do campo "Serviço de interesse" (formulário público, leads e clientes). */
export const SERVICE_INTERESTS = [
  "fotografia",
  "video",
  "marketing",
  "eventos",
  "casamentos",
  "pacote_mensal",
  "outro",
] as const;
export type ServiceInterest = (typeof SERVICE_INTERESTS)[number];
export const SERVICE_INTEREST_LABELS = labels(SERVICE_INTERESTS, {
  fotografia: "Fotografia",
  video: "Vídeo e produção audiovisual",
  marketing: "Marketing e redes sociais",
  eventos: "Cobertura de evento",
  casamentos: "Casamento",
  pacote_mensal: "Pacote mensal",
  outro: "Outro / ainda não sei",
});

// ----------------------------------------------------------------- clientes
export const CLIENT_KINDS = ["pf", "pj"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];
export const CLIENT_KIND_LABELS = labels(CLIENT_KINDS, { pf: "Pessoa física", pj: "Empresa" });

/** Funil: Novo contato → Em orçamento → Negociação → Fechado → Em produção → Finalizado (+ Perdido / Cancelado). */
export const CLIENT_STATUSES = [
  "novo_contato",
  "em_orcamento",
  "negociacao",
  "fechado",
  "em_producao",
  "finalizado",
  "perdido",
  "cancelado",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_LABELS = labels(CLIENT_STATUSES, {
  novo_contato: "Novo contato",
  em_orcamento: "Em orçamento",
  negociacao: "Negociação",
  fechado: "Fechado",
  em_producao: "Em produção",
  finalizado: "Finalizado",
  perdido: "Perdido",
  cancelado: "Cancelado",
});
/** Etapas "vivas" do funil, na ordem. Perdido/Cancelado ficam fora do fluxo principal. */
export const CLIENT_PIPELINE: readonly ClientStatus[] = [
  "novo_contato",
  "em_orcamento",
  "negociacao",
  "fechado",
  "em_producao",
  "finalizado",
];
export const CLIENT_ACTIVE_STATUSES: readonly ClientStatus[] = ["fechado", "em_producao"];

export const INTERACTION_KINDS = ["nota", "whatsapp", "ligacao", "reuniao", "email", "status"] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];
export const INTERACTION_KIND_LABELS = labels(INTERACTION_KINDS, {
  nota: "Anotação",
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  reuniao: "Reunião",
  email: "E-mail",
  status: "Mudança de status",
});

// ----------------------------------------------------------------- projetos
export const PROJECT_STAGES = [
  "briefing",
  "planejamento",
  "gravacao",
  "edicao",
  "revisao",
  "entregue",
  "cancelado",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];
export const PROJECT_STAGE_LABELS = labels(PROJECT_STAGES, {
  briefing: "Briefing",
  planejamento: "Planejamento",
  gravacao: "Gravação",
  edicao: "Edição",
  revisao: "Revisão",
  entregue: "Entregue",
  cancelado: "Cancelado",
});
export const PROJECT_OPEN_STAGES: readonly ProjectStage[] = [
  "briefing",
  "planejamento",
  "gravacao",
  "edicao",
  "revisao",
];

export const BACKUP_STATUSES = ["pendente", "parcial", "ok"] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];
export const BACKUP_STATUS_LABELS = labels(BACKUP_STATUSES, {
  pendente: "Backup pendente",
  parcial: "Backup parcial",
  ok: "Backup feito",
});

export const TASK_PRIORITIES = ["baixa", "normal", "alta"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS = labels(TASK_PRIORITIES, { baixa: "Baixa", normal: "Normal", alta: "Alta" });

// ------------------------------------------------------------------- agenda
export const AGENDA_KINDS = ["gravacao", "evento", "reuniao", "entrega", "outro"] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];
export const AGENDA_KIND_LABELS = labels(AGENDA_KINDS, {
  gravacao: "Gravação",
  evento: "Evento",
  reuniao: "Reunião",
  entrega: "Entrega",
  outro: "Outro",
});

// ---------------------------------------------------------------- propostas
export const PROPOSAL_MODALITIES = ["mensal", "diaria_evento", "casamento", "personalizada"] as const;
export type ProposalModality = (typeof PROPOSAL_MODALITIES)[number];
export const PROPOSAL_MODALITY_LABELS = labels(PROPOSAL_MODALITIES, {
  mensal: "Mensal",
  diaria_evento: "Diária / Evento",
  casamento: "Casamento",
  personalizada: "Personalizada",
});

export const PROPOSAL_STATUSES = ["rascunho", "enviada", "aceita", "recusada", "expirada"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABELS = labels(PROPOSAL_STATUSES, {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
});

export const PROPOSAL_ITEM_KINDS = ["incluso", "opcional"] as const;
export type ProposalItemKind = (typeof PROPOSAL_ITEM_KINDS)[number];
export const PROPOSAL_ITEM_KIND_LABELS = labels(PROPOSAL_ITEM_KINDS, {
  incluso: "Incluso na proposta",
  opcional: "Opcional",
});

/** Custos internos — NUNCA aparecem no PDF nem em nada público. */
export const PROPOSAL_COST_CATEGORIES = ["equipe", "locacao", "deslocamento", "pos_producao", "outros"] as const;
export type ProposalCostCategory = (typeof PROPOSAL_COST_CATEGORIES)[number];
export const PROPOSAL_COST_CATEGORY_LABELS = labels(PROPOSAL_COST_CATEGORIES, {
  equipe: "Equipe / freelancers",
  locacao: "Locação de equipamentos",
  deslocamento: "Deslocamento",
  pos_producao: "Pós-produção",
  outros: "Outras despesas",
});

export const ENTRY_MODES = ["percentual", "valor"] as const;
export type EntryMode = (typeof ENTRY_MODES)[number];

// ---------------------------------------------------------------- contratos
export const CONTRACT_KINDS = ["mensal", "evento", "casamento", "diaria", "socios", "outro"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];
export const CONTRACT_KIND_LABELS = labels(CONTRACT_KINDS, {
  mensal: "Contrato mensal",
  evento: "Contrato de evento",
  casamento: "Contrato de casamento",
  diaria: "Contrato de diária",
  socios: "Acordo entre sócios",
  outro: "Outro documento",
});

export const CONTRACT_STATUSES = ["rascunho", "enviado", "assinado", "encerrado", "cancelado"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export const CONTRACT_STATUS_LABELS = labels(CONTRACT_STATUSES, {
  rascunho: "Rascunho",
  enviado: "Enviado para assinatura",
  assinado: "Assinado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
});

// --------------------------------------------------------------- financeiro
export const FINANCE_TYPES = ["receita", "despesa"] as const;
export type FinanceType = (typeof FINANCE_TYPES)[number];
export const FINANCE_TYPE_LABELS = labels(FINANCE_TYPES, { receita: "Receita", despesa: "Despesa" });

export const FINANCE_CATEGORIES = [
  // receitas
  "servico",
  "pacote_mensal",
  "outras_receitas",
  // despesas
  "producao",
  "freelancer",
  "aluguel_equipamento",
  "deslocamento",
  "software",
  "marketing",
  "impostos",
  "pro_labore",
  "reserva",
  "outras_despesas",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
export const FINANCE_CATEGORY_LABELS = labels(FINANCE_CATEGORIES, {
  servico: "Serviço / projeto",
  pacote_mensal: "Pacote mensal",
  outras_receitas: "Outras receitas",
  producao: "Custos de produção",
  freelancer: "Pagamento de freelancers",
  aluguel_equipamento: "Aluguel de equipamentos",
  deslocamento: "Deslocamento",
  software: "Softwares e assinaturas",
  marketing: "Marketing da NÓS",
  impostos: "Impostos e taxas",
  pro_labore: "Pró-labore",
  reserva: "Reserva de caixa",
  outras_despesas: "Outras despesas",
});
export const FINANCE_CATEGORIES_BY_TYPE: Record<FinanceType, readonly FinanceCategory[]> = {
  receita: ["servico", "pacote_mensal", "outras_receitas"],
  despesa: [
    "producao",
    "freelancer",
    "aluguel_equipamento",
    "deslocamento",
    "software",
    "marketing",
    "impostos",
    "pro_labore",
    "reserva",
    "outras_despesas",
  ],
};

export const PAYMENT_METHODS = ["pix", "transferencia", "cartao", "boleto", "dinheiro", "outro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS = labels(PAYMENT_METHODS, {
  pix: "Pix",
  transferencia: "Transferência",
  cartao: "Cartão",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  outro: "Outro",
});

// ----------------------------------------------------- calendário editorial
export const CONTENT_STATUSES = ["ideia", "roteiro", "gravacao", "edicao", "aprovacao", "publicado"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const CONTENT_STATUS_LABELS = labels(CONTENT_STATUSES, {
  ideia: "Ideia",
  roteiro: "Roteiro",
  gravacao: "Gravação",
  edicao: "Edição",
  aprovacao: "Aprovação",
  publicado: "Publicado",
});

export const CONTENT_NETWORKS = ["instagram", "tiktok", "youtube", "linkedin", "facebook", "outro"] as const;
export type ContentNetwork = (typeof CONTENT_NETWORKS)[number];
export const CONTENT_NETWORK_LABELS = labels(CONTENT_NETWORKS, {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  outro: "Outro",
});

export const CONTENT_FORMATS = ["reels", "carrossel", "post", "stories", "video_longo", "outro"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export const CONTENT_FORMAT_LABELS = labels(CONTENT_FORMATS, {
  reels: "Reels / vídeo curto",
  carrossel: "Carrossel",
  post: "Post (imagem)",
  stories: "Stories",
  video_longo: "Vídeo longo",
  outro: "Outro",
});

export const APPROVAL_STATUSES = ["pendente", "aprovado", "ajustes"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const APPROVAL_STATUS_LABELS = labels(APPROVAL_STATUSES, {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  ajustes: "Ajustes solicitados",
});

// ------------------------------------------------------ biblioteca da marca
export const BRAND_ASSET_CATEGORIES = [
  "logo",
  "paleta",
  "fontes",
  "templates",
  "apresentacao",
  "propostas",
  "divulgacao",
  "manual",
  "outro",
] as const;
export type BrandAssetCategory = (typeof BRAND_ASSET_CATEGORIES)[number];
export const BRAND_ASSET_CATEGORY_LABELS = labels(BRAND_ASSET_CATEGORIES, {
  logo: "Versões do logo",
  paleta: "Paleta oficial",
  fontes: "Fontes",
  templates: "Templates",
  apresentacao: "Apresentação institucional",
  propostas: "Propostas comerciais",
  divulgacao: "Materiais de divulgação",
  manual: "Manual da marca",
  outro: "Outros",
});

// -------------------------------------------------------------------- mídia
export const MEDIA_VISIBILITIES = ["public", "private"] as const;
export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[number];
