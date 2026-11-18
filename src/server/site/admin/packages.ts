import "server-only";
import { asc, eq } from "drizzle-orm";
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
  /** Só vale quando `priceMode` não é "sob_consulta". */
  priceCents: number | null;
  priceSuffix: string;
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

export async function savePackage(id: number | null, input: PackageInput): Promise<Package | null> {
  const values = { ...input, priceCents: input.priceMode === "sob_consulta" ? null : input.priceCents };
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
  return row ?? null;
}
