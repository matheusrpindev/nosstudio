/**
 * Vocabulário de domínio da NÓS Studio: enums e rótulos em pt-BR.
 * Arquivo puro (sem dependências de servidor) — pode ser importado em Server e Client Components.
 * O schema do banco (src/db/schema.ts) importa as listas daqui: mude um status aqui e ele vale no sistema todo.
 */

function labels<const T extends readonly string[]>(_keys: T, map: Record<T[number], string>) {
  return map;
}

// ---------------------------------------------------------------- usuários
/**
 * Perfis de acesso (briefing v2, seção 28). O que cada perfil pode fazer NÃO fica aqui: ambientes e matriz de
 * permissões vivem em `src/lib/permissions` (fonte única). `tecnico` é o acesso temporário do desenvolvedor.
 */
export const USER_ROLES = ["admin", "socio", "gestor", "funcionario", "freelancer", "cliente", "tecnico"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_ROLE_LABELS = labels(USER_ROLES, {
  admin: "Administrador(a)",
  socio: "Sócio(a)",
  gestor: "Gestor(a) de projetos",
  funcionario: "Funcionário(a)",
  freelancer: "Freelancer",
  cliente: "Cliente",
  tecnico: "Acesso técnico (temporário)",
});
/** Uma frase por perfil, para as telas de usuários e convites. */
export const USER_ROLE_DESCRIPTIONS = labels(USER_ROLES, {
  admin: "Acesso completo, inclusive gerenciar contas, exportar dados e ver a auditoria.",
  socio: "Acesso completo, como o administrador, incluindo a área societária (pró-labore, retiradas, distribuição).",
  gestor: "Opera o dia a dia: leads, clientes, propostas, contratos, projetos, agenda, conteúdo, arquivos e equipe. Não vê o financeiro nem as configurações.",
  funcionario: "Trabalha nos projetos em que foi incluído: tarefas, agenda, conteúdo e arquivos desses projetos. Sem comercial nem financeiro.",
  freelancer: "Só a Área da Equipe, e apenas os projetos para os quais foi escalado.",
  cliente: "Só a Área do Cliente, e apenas os projetos dos clientes a que a conta está vinculada.",
  tecnico: "Conta do desenvolvedor para dar suporte. Acessa o painel, mas não gerencia contas nem exporta dados. É temporária: revogue quando o suporte acabar.",
});

/**
 * Funções iniciais da equipe (briefing v2, seção 17). São SUGESTÕES para o papel de alguém num projeto
 * (`project_members.role` é texto livre: novas funções podem ser digitadas).
 */
export const TEAM_FUNCTIONS = [
  "Fotógrafo",
  "Filmmaker",
  "Editor",
  "Designer",
  "Social media",
  "Storymaker",
  "Tráfego",
  "Roteirista",
  "Assistente",
  "Drone",
  "Áudio",
  "Iluminação",
  "Atendimento",
  "Administrativo",
] as const;

// ------------------------------------------------------- paleta / aparência
/** Cores oficiais da marca. Usadas, por exemplo, na barra de avisos (fundo/texto). */
export const BRAND_COLORS = ["roxo", "lima", "lavanda", "offwhite", "grafite", "preto", "branco"] as const;
export type BrandColor = (typeof BRAND_COLORS)[number];
export const BRAND_COLOR_HEX: Record<BrandColor, string> = {
  roxo: "#3B1F8E",
  lima: "#C6F432",
  lavanda: "#CFC6FF",
  offwhite: "#F6F4EF",
  grafite: "#1B1B22",
  preto: "#101014",
  branco: "#FFFFFF",
};
export const BRAND_COLOR_LABELS = labels(BRAND_COLORS, {
  roxo: "Roxo",
  lima: "Lima",
  lavanda: "Lavanda",
  offwhite: "Off-white",
  grafite: "Grafite",
  preto: "Preto",
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
  sob_consulta: "Valor oculto",
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

/**
 * Opções do campo "Serviço de interesse" (formulário público, leads e clientes). São as nove áreas do briefing v2
 * (seção 06) + plano mensal + "ainda não sei". Um serviço novo cadastrado no painel escolhe uma destas.
 */
export const SERVICE_INTERESTS = [
  "marketing",
  "redes_sociais",
  "video",
  "fotografia",
  "design",
  "identidade_visual",
  "trafego",
  "eventos",
  "casamentos",
  "pacote_mensal",
  "outro",
] as const;
export type ServiceInterest = (typeof SERVICE_INTERESTS)[number];
export const SERVICE_INTEREST_LABELS = labels(SERVICE_INTERESTS, {
  marketing: "Marketing e estratégia",
  redes_sociais: "Redes sociais",
  video: "Audiovisual",
  fotografia: "Fotografia",
  design: "Design gráfico",
  identidade_visual: "Identidade visual",
  trafego: "Tráfego pago",
  eventos: "Eventos e storymaker",
  casamentos: "Casamentos",
  pacote_mensal: "Plano mensal",
  outro: "Outro / ainda não sei",
});

/**
 * Campos adicionais do formulário de captação conforme o tipo do pedido (briefing v2, seção 10):
 * marketing → segmento e perfil; audiovisual → tipo e previsão; evento → data e local.
 */
export const LEAD_FIELD_GROUPS = ["marketing", "audiovisual", "evento"] as const;
export type LeadFieldGroup = (typeof LEAD_FIELD_GROUPS)[number];
const INTEREST_FIELD_GROUP: Record<ServiceInterest, LeadFieldGroup | null> = {
  marketing: "marketing",
  redes_sociais: "marketing",
  design: "marketing",
  identidade_visual: "marketing",
  trafego: "marketing",
  pacote_mensal: "marketing",
  video: "audiovisual",
  fotografia: "audiovisual",
  eventos: "evento",
  casamentos: "evento",
  outro: null,
};
/** Grupo de campos adicionais de um interesse (`null` = só os campos comuns). */
export function leadFieldGroup(interest: string | null | undefined): LeadFieldGroup | null {
  return interest && Object.hasOwn(INTEREST_FIELD_GROUP, interest) ? INTEREST_FIELD_GROUP[interest as ServiceInterest] : null;
}

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
/**
 * Tipos ANTIGOS da agenda (coluna `agenda_events.kind`). Desde a agenda v2 o que vale é a CATEGORIA
 * (`agenda_categories`); esta coluna continua gravada só como resumo grosso para as telas que ainda a leem
 * (visão geral, ficha do cliente, projeto). Não use em telas novas.
 */
export const AGENDA_KINDS = ["gravacao", "evento", "reuniao", "entrega", "outro"] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];
export const AGENDA_KIND_LABELS = labels(AGENDA_KINDS, {
  gravacao: "Gravação",
  evento: "Evento",
  reuniao: "Reunião",
  entrega: "Entrega",
  outro: "Outro",
});

/** Tons disponíveis para categorias e agendas (classes `.agenda-tom-*` em globals.css; nunca hex livre). */
export const AGENDA_COLORS = ["roxo", "lavanda", "lima", "verde", "ciano", "azul", "rosa", "laranja", "amarelo", "vermelho", "cinza"] as const;
export type AgendaColor = (typeof AGENDA_COLORS)[number];
export const AGENDA_COLOR_LABELS = labels(AGENDA_COLORS, {
  roxo: "Roxo",
  lavanda: "Lavanda",
  lima: "Lima",
  verde: "Verde",
  ciano: "Ciano",
  azul: "Azul",
  rosa: "Rosa",
  laranja: "Laranja",
  amarelo: "Amarelo",
  vermelho: "Vermelho",
  cinza: "Cinza",
});

/** Ícones disponíveis para categorias (conjunto fechado do lucide; o mapa nome → componente fica na agenda). */
export const AGENDA_ICONS = [
  "calendar",
  "users",
  "handshake",
  "megaphone",
  "phone",
  "video",
  "clapperboard",
  "camera",
  "mic",
  "party-popper",
  "heart",
  "scissors",
  "send",
  "package-check",
  "circle-check",
  "file-clock",
  "banknote",
  "landmark",
  "briefcase",
  "user",
  "tree-palm",
  "plane",
  "map-pin",
  "star",
  "flag",
  "coffee",
] as const;
export type AgendaIcon = (typeof AGENDA_ICONS)[number];
export const AGENDA_ICON_LABELS = labels(AGENDA_ICONS, {
  calendar: "Calendário",
  users: "Pessoas",
  handshake: "Aperto de mão",
  megaphone: "Megafone",
  phone: "Telefone",
  video: "Câmera de vídeo",
  clapperboard: "Claquete",
  camera: "Câmera fotográfica",
  mic: "Microfone",
  "party-popper": "Festa",
  heart: "Coração",
  scissors: "Tesoura",
  send: "Enviar",
  "package-check": "Pacote entregue",
  "circle-check": "Aprovado",
  "file-clock": "Prazo",
  banknote: "Dinheiro",
  landmark: "Banco",
  briefcase: "Maleta",
  user: "Pessoa",
  "tree-palm": "Férias",
  plane: "Viagem",
  "map-pin": "Local",
  star: "Estrela",
  flag: "Bandeira",
  coffee: "Café",
});

/** Tipos de agenda (calendário). `financeira` e `editorial` são camadas derivadas: não recebem compromissos. */
export const AGENDA_CALENDAR_KINDS = ["geral", "pessoal", "producoes", "comercial", "financeira", "editorial", "colaboradores"] as const;
export type AgendaCalendarKind = (typeof AGENDA_CALENDAR_KINDS)[number];
export const AGENDA_CALENDAR_KIND_LABELS = labels(AGENDA_CALENDAR_KINDS, {
  geral: "Geral",
  pessoal: "Pessoal",
  producoes: "Produções",
  comercial: "Comercial",
  financeira: "Financeira",
  editorial: "Editorial",
  colaboradores: "Colaboradores",
});
export const AGENDA_DERIVED_CALENDAR_KINDS: readonly AgendaCalendarKind[] = ["financeira", "editorial"];

/** Camadas somente leitura que podem ser ligadas sobre a agenda. */
export const AGENDA_LAYERS = ["prazos", "editorial", "financeira"] as const;
export type AgendaLayer = (typeof AGENDA_LAYERS)[number];
export const AGENDA_LAYER_LABELS = labels(AGENDA_LAYERS, {
  prazos: "Prazos de projeto",
  editorial: "Editorial",
  financeira: "Financeira",
});
/** Ligadas quando a pessoa ainda não escolheu (a financeira fica de fora para não poluir a operação). */
export const AGENDA_DEFAULT_LAYERS: readonly AgendaLayer[] = ["prazos", "editorial"];

/** Visões de CALENDÁRIO (as cinco do seletor) e, depois delas, as duas de PLANEJAMENTO. */
export const AGENDA_VIEWS = ["dia", "semana", "mes", "ano", "lista", "disponibilidade", "linha"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];
export const AGENDA_VIEW_LABELS = labels(AGENDA_VIEWS, {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
  lista: "Lista",
  disponibilidade: "Disponibilidade",
  linha: "Linha do tempo",
});
export const AGENDA_CALENDAR_VIEWS = ["dia", "semana", "mes", "ano", "lista"] as const satisfies readonly AgendaView[];
export const AGENDA_PLANNING_VIEWS = ["disponibilidade", "linha"] as const satisfies readonly AgendaView[];

export const AGENDA_STATUSES = ["confirmado", "a_confirmar", "cancelado", "concluido"] as const;
export type AgendaStatus = (typeof AGENDA_STATUSES)[number];
export const AGENDA_STATUS_LABELS = labels(AGENDA_STATUSES, {
  confirmado: "Confirmado",
  a_confirmar: "A confirmar",
  cancelado: "Cancelado",
  concluido: "Concluído",
});

export const AGENDA_PRIORITIES = ["baixa", "normal", "alta"] as const;
export type AgendaPriority = (typeof AGENDA_PRIORITIES)[number];
export const AGENDA_PRIORITY_LABELS = labels(AGENDA_PRIORITIES, { baixa: "Baixa", normal: "Normal", alta: "Alta" });

export const AGENDA_VISIBILITIES = ["normal", "particular"] as const;
export type AgendaVisibility = (typeof AGENDA_VISIBILITIES)[number];
export const AGENDA_VISIBILITY_LABELS = labels(AGENDA_VISIBILITIES, { normal: "Normal", particular: "Particular" });
/** Como um compromisso particular aparece para quem não participa dele. */
export const AGENDA_BUSY_LABEL = "Ocupado";

export const AGENDA_PERSON_ROLES = ["responsavel", "participante", "externo"] as const;
export type AgendaPersonRole = (typeof AGENDA_PERSON_ROLES)[number];
export const AGENDA_PERSON_ROLE_LABELS = labels(AGENDA_PERSON_ROLES, {
  responsavel: "Responsável",
  participante: "Participante",
  externo: "Participante externo",
});

export const AGENDA_REMINDER_CHANNELS = ["interno", "email"] as const;
export type AgendaReminderChannel = (typeof AGENDA_REMINDER_CHANNELS)[number];
export const AGENDA_REMINDER_CHANNEL_LABELS = labels(AGENDA_REMINDER_CHANNELS, { interno: "Aviso no painel", email: "E-mail" });
/** Antecedências prontas, em minutos. Outras entram como "personalizada". */
export const AGENDA_REMINDER_PRESETS = [
  { minutes: 15, label: "15 minutos antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 1440, label: "1 dia antes" },
  { minutes: 10080, label: "7 dias antes" },
] as const;
export const AGENDA_REMINDER_MAX_MINUTES = 60 * 24 * 60; // 60 dias
/** Compromisso de dia inteiro não tem hora: os lembretes dele contam a partir deste horário do dia. */
export const AGENDA_ALL_DAY_REMINDER_TIME = "09:00";
/** Expediente considerado na consulta de disponibilidade (janelas livres em comum). */
export const AGENDA_WORKDAY = { start: "08:00", end: "20:00" } as const;

// ------------------------------------------------------------ notificações
/**
 * Tipos de notificação interna (central de notificações — briefing v2, seção 30). Por enquanto só a agenda
 * envia; cada módulo que passar a notificar acrescenta o seu tipo aqui.
 */
export const NOTIFICATION_TYPES = ["agenda_lembrete"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_TYPE_LABELS = labels(NOTIFICATION_TYPES, { agenda_lembrete: "Lembrete da agenda" });

/** Como terminou a entrega de um lembrete (a linha existe para o mesmo lembrete nunca sair duas vezes). */
export const REMINDER_DELIVERY_STATUSES = ["enviado", "falhou", "sem_smtp"] as const;
export type ReminderDeliveryStatus = (typeof REMINDER_DELIVERY_STATUSES)[number];

/** "Só este", "este e os seguintes", "todos": a quem se aplica a mudança numa série que se repete. */
export const AGENDA_SERIES_SCOPES = ["este", "seguintes", "todos"] as const;
export type AgendaSeriesScope = (typeof AGENDA_SERIES_SCOPES)[number];
export const AGENDA_SERIES_SCOPE_LABELS = labels(AGENDA_SERIES_SCOPES, {
  este: "Só este",
  seguintes: "Este e os seguintes",
  todos: "Todos da série",
});

export type AgendaCategorySeed = {
  slug: string;
  name: string;
  color: AgendaColor;
  icon: AgendaIcon;
  blocksDay?: boolean;
  isProduction?: boolean;
  /** Resumo gravado em `agenda_events.kind` para as telas antigas. */
  legacyKind: AgendaKind;
};
/**
 * Categorias iniciais (o cliente pode renomear, recolorir, criar outras e desativar). A migration
 * `0002` insere exatamente esta lista — o teste `migration.db.test.ts` confere que as duas batem.
 */
export const AGENDA_DEFAULT_CATEGORIES: readonly AgendaCategorySeed[] = [
  { slug: "reunioes-internas", name: "Reuniões internas", color: "lavanda", icon: "users", legacyKind: "reuniao" },
  { slug: "reunioes-clientes", name: "Reuniões com clientes", color: "roxo", icon: "handshake", legacyKind: "reuniao" },
  { slug: "prospeccao", name: "Prospecção comercial", color: "amarelo", icon: "megaphone", legacyKind: "outro" },
  { slug: "gravacoes", name: "Gravações", color: "lima", icon: "video", isProduction: true, legacyKind: "gravacao" },
  { slug: "sessoes-fotograficas", name: "Sessões fotográficas", color: "verde", icon: "camera", isProduction: true, legacyKind: "gravacao" },
  { slug: "eventos", name: "Eventos", color: "laranja", icon: "party-popper", isProduction: true, legacyKind: "evento" },
  { slug: "casamentos", name: "Casamentos", color: "rosa", icon: "heart", isProduction: true, legacyKind: "evento" },
  { slug: "edicao", name: "Edição e pós-produção", color: "azul", icon: "scissors", legacyKind: "outro" },
  { slug: "publicacoes", name: "Publicações", color: "ciano", icon: "send", legacyKind: "outro" },
  { slug: "entregas", name: "Entregas", color: "verde", icon: "package-check", legacyKind: "entrega" },
  { slug: "aprovacoes", name: "Aprovações", color: "lavanda", icon: "circle-check", legacyKind: "outro" },
  { slug: "prazos-contratuais", name: "Prazos contratuais", color: "vermelho", icon: "file-clock", legacyKind: "outro" },
  { slug: "pagamentos", name: "Pagamentos", color: "amarelo", icon: "banknote", legacyKind: "outro" },
  { slug: "compromissos-financeiros", name: "Compromissos financeiros", color: "laranja", icon: "landmark", legacyKind: "outro" },
  { slug: "pessoais", name: "Compromissos pessoais", color: "cinza", icon: "user", legacyKind: "outro" },
  { slug: "ferias", name: "Férias e indisponibilidade", color: "cinza", icon: "tree-palm", blocksDay: true, legacyKind: "outro" },
  { slug: "outros", name: "Outros", color: "cinza", icon: "calendar", legacyKind: "outro" },
];
/** Categoria de quem não tem categoria (compromisso antigo do tipo "outro", categoria desativada). */
export const AGENDA_FALLBACK_CATEGORY_SLUG = "outros";
/** Categoria sugerida ao criar um compromisso. */
export const AGENDA_DEFAULT_CATEGORY_SLUG = "reunioes-internas";

export type AgendaCalendarSeed = { slug: string; name: string; kind: AgendaCalendarKind; color: AgendaColor };
/** Agendas iniciais. As pessoais (uma por usuário do painel) são criadas à parte, sob demanda. */
export const AGENDA_DEFAULT_CALENDARS: readonly AgendaCalendarSeed[] = [
  { slug: "geral", name: "Agenda geral da NÓS", kind: "geral", color: "roxo" },
  { slug: "producoes", name: "Produções", kind: "producoes", color: "lima" },
  { slug: "comercial", name: "Comercial", kind: "comercial", color: "amarelo" },
  { slug: "financeira", name: "Financeira", kind: "financeira", color: "verde" },
  { slug: "editorial", name: "Editorial", kind: "editorial", color: "ciano" },
  { slug: "colaboradores", name: "Colaboradores", kind: "colaboradores", color: "laranja" },
];
/** Cores das agendas pessoais, na ordem em que as contas foram criadas. */
export const AGENDA_PERSONAL_COLORS: readonly AgendaColor[] = ["lavanda", "rosa", "azul", "ciano", "laranja", "verde"];

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
