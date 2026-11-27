/**
 * Tabela comparativa dos planos (briefing v2, seção 07). Arquivo puro, testado em plans.test.ts.
 *
 * A tabela é MONTADA a partir do que cada plano declara em "Inclui" — não há uma lista paralela para manter:
 * - um plano com plano-base ("tudo do Essencial, mais…") herda as entregas do base (e do base do base);
 * - as linhas seguem a ordem em que as entregas aparecem, do primeiro plano ao último;
 * - a célula só é marcada quando a entrega está na lista do plano (própria ou herdada). O site nunca marca algo
 *   que os sócios não cadastraram.
 */
export type ComparablePlan = { id: number; name: string; includes: readonly string[]; base: { id: number } | null };

const keyOf = (label: string) => label.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

/** Entregas de um plano, com as herdadas do plano-base primeiro. Sem repetição; à prova de ciclo (A→B→A). */
export function planFeatures(plan: ComparablePlan, plans: readonly ComparablePlan[]): string[] {
  const chain: ComparablePlan[] = [];
  const seen = new Set<number>();
  for (let current: ComparablePlan | undefined = plan; current && !seen.has(current.id); ) {
    seen.add(current.id);
    chain.unshift(current);
    const baseId: number | undefined = current.base?.id;
    current = baseId === undefined ? undefined : plans.find((other) => other.id === baseId);
  }
  const keys = new Set<string>();
  const features: string[] = [];
  for (const item of chain.flatMap((link) => link.includes)) {
    const label = item.trim();
    const key = keyOf(label);
    if (!key || keys.has(key)) continue;
    keys.add(key);
    features.push(label);
  }
  return features;
}

export type PlanComparison = {
  columns: { id: number; name: string }[];
  rows: { label: string; cells: boolean[] }[];
};

/** Linhas (entregas) × colunas (planos). Sem planos ou sem entregas, `rows` vem vazio (a tabela não aparece). */
export function buildPlanComparison(plans: readonly ComparablePlan[]): PlanComparison {
  const perPlan = plans.map((plan) => planFeatures(plan, plans));
  const order: string[] = [];
  const labels = new Map<string, string>();
  for (const features of perPlan) {
    for (const label of features) {
      const key = keyOf(label);
      if (labels.has(key)) continue;
      labels.set(key, label);
      order.push(key);
    }
  }
  const sets = perPlan.map((features) => new Set(features.map(keyOf)));
  return {
    columns: plans.map((plan) => ({ id: plan.id, name: plan.name })),
    rows: order.map((key) => ({ label: labels.get(key) ?? key, cells: sets.map((set) => set.has(key)) })),
  };
}
