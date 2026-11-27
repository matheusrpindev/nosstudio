import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { packages, type Deliverable, type Package } from "@/db/schema";
import type { PackageKind, PriceMode } from "@/lib/domain";
import { moveInOrder, nextSortOrder, type MoveDirection } from "./order";

export type PackageInput = {
  kind: PackageKind;
  name: string;
  tagline: string;
  description: string;
  includes: string[];
  deliverables: Deliverable[];
  recordingDuration: string;
  revisionLimit: string;
  priceMode: PriceMode;
  /** Fica guardado mesmo com o valor oculto (`sob_consulta`): o site só o mostra nos outros modos. */
  priceCents: number | null;
  priceSuffix: string;
  /** Condição de desconto (texto). Só aparece no site junto de um valor publicado. */
  discountNote: string;
  /** Opcionais que podem ser acrescentados. */
  optionals: string[];
  /** Plano em que este se apoia ("tudo do plano X, mais…"). Só entre planos mensais; nunca ele mesmo. */
  basePackageId: number | null;
  recommended: boolean;
  ctaLabel: string;
  visible: boolean;
};

export async function listPackages(): Promise<Package[]> {
  return db.select().from(packages).orderBy(asc(packages.sortOrder), asc(packages.id));
}

export async function getPackage(id: number): Promise<Package | null> {
  const [row] = await db.select().from(packages).where(eq(packages.id, id));
  return row ?? null;
}

/** Planos mensais que podem servir de base para `exceptId` (todos os outros planos). */
export async function listBasePlanOptions(exceptId?: number): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: packages.id, name: packages.name })
    .from(packages)
    .where(exceptId === undefined ? eq(packages.kind, "plano") : and(eq(packages.kind, "plano"), ne(packages.id, exceptId)))
    .orderBy(asc(packages.sortOrder), asc(packages.id));
}

export async function savePackage(id: number | null, input: PackageInput): Promise<Package | null> {
  // plano-base: só para planos mensais, só outro plano existente — e sem laço direto (A apoia-se em B e B em A)
  let basePackageId: number | null = null;
  if (input.kind === "plano" && input.basePackageId !== null && input.basePackageId !== id) {
    const [base] = await db.select().from(packages).where(and(eq(packages.id, input.basePackageId), eq(packages.kind, "plano")));
    if (base && (id === null || base.basePackageId !== id)) basePackageId = base.id;
  }
  const values = { ...input, basePackageId };
  if (id === null) {
    const [row] = await db.insert(packages).values({ ...values, sortOrder: await nextSortOrder(packages) }).returning();
    return row;
  }
  const [row] = await db.update(packages).set(values).where(eq(packages.id, id)).returning();
  return row ?? null;
}

export async function setPackageVisible(id: number, visible: boolean): Promise<Package | null> {
  const [row] = await db.update(packages).set({ visible }).where(eq(packages.id, id)).returning();
  return row ?? null;
}

/** Planos e avulsos aparecem em blocos separados no site: a ordem vale dentro de cada grupo. */
export async function movePackage(id: number, direction: MoveDirection): Promise<boolean> {
  const current = await getPackage(id);
  if (!current) return false;
  return moveInOrder(packages, id, direction, "asc", eq(packages.kind, current.kind));
}

export async function deletePackage(id: number): Promise<Package | null> {
  const [row] = await db.delete(packages).where(eq(packages.id, id)).returning();
  // quem se apoiava neste plano deixa de ter plano-base
  if (row) await db.update(packages).set({ basePackageId: null }).where(eq(packages.basePackageId, id));
  return row ?? null;
}
