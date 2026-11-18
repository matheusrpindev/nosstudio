/** Rótulos em português da trilha de auditoria. Valores desconhecidos aparecem como estão. */
export const ACTION_LABELS: Record<string, string> = {
  activate: "Reativou",
  create: "Criou",
  deactivate: "Desativou",
  delete: "Excluiu",
  export: "Exportou",
  login: "Entrou",
  logout: "Saiu",
  password_change: "Trocou a senha",
  password_reset: "Redefiniu a senha",
  pdf: "Gerou PDF",
  status: "Mudou o status",
  update: "Alterou",
};

export const ENTITY_LABELS: Record<string, string> = {
  agenda: "Agenda",
  agenda_event: "Agenda",
  announcement: "Aviso do site",
  brand: "Marca",
  brand_asset: "Marca",
  client: "Cliente",
  content: "Conteúdo",
  content_item: "Conteúdo",
  contract: "Contrato",
  dados: "Dados",
  faq: "FAQ",
  finance: "Financeiro",
  finance_entry: "Financeiro",
  lead: "Lead",
  package: "Pacote",
  portfolio: "Portfólio",
  project: "Projeto",
  proposal: "Orçamento",
  service: "Serviço",
  settings: "Configurações",
  site_content: "Texto do site",
  task: "Tarefa",
  testimonial: "Depoimento",
  user: "Usuário",
  session: "Sessão",
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
export const entityLabel = (entity: string | null) => (entity ? (ENTITY_LABELS[entity] ?? entity) : "");
