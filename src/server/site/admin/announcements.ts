import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, type Announcement } from "@/db/schema";
import type { BrandColor } from "@/lib/domain";
import { normalizeAnnouncementPages } from "@/lib/site/announcement-pages";
import { moveInOrder, nextSortOrder, type MoveDirection } from "./order";

export type AnnouncementInput = {
  message: string;
  linkLabel: string;
  linkUrl: string;
  bgColor: BrandColor;
  textColor: BrandColor;
  startsAt: string | null;
  endsAt: string | null;
  dismissible: boolean;
  enabled: boolean;
  /** Páginas em que aparece (chaves de `ANNOUNCEMENT_PAGE_KEYS`). Vazio = todas. */
  pages: string[];
};

/** Na mesma ordem do site: `sortOrder`, depois o mais novo primeiro. */
export async function listAnnouncements(): Promise<Announcement[]> {
  return db.select().from(announcements).orderBy(asc(announcements.sortOrder), desc(announcements.id));
}

export async function getAnnouncement(id: number): Promise<Announcement | null> {
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id));
  return row ?? null;
}

const toRow = (input: AnnouncementInput) => ({
  message: input.message,
  linkLabel: input.linkUrl ? input.linkLabel || null : null,
  linkUrl: input.linkUrl || null,
  bgColor: input.bgColor,
  textColor: input.textColor,
  startsAt: input.startsAt,
  endsAt: input.endsAt,
  dismissible: input.dismissible,
  enabled: input.enabled,
  pages: normalizeAnnouncementPages(input.pages),
});

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  // Avisos novos entram no INÍCIO da lista (a ordem pública é sortOrder asc): o mais novo é o que o sócio quer ver no ar.
  // Para não renumerar tudo, usamos o menor número existente - 1.
  const first = (await listAnnouncements())[0];
  const sortOrder = first ? first.sortOrder - 1 : await nextSortOrder(announcements);
  const [row] = await db.insert(announcements).values({ ...toRow(input), sortOrder }).returning();
  return row;
}

export async function updateAnnouncement(id: number, input: AnnouncementInput): Promise<Announcement | null> {
  const [row] = await db.update(announcements).set(toRow(input)).where(eq(announcements.id, id)).returning();
  return row ?? null;
}

export async function setAnnouncementEnabled(id: number, enabled: boolean): Promise<Announcement | null> {
  const [row] = await db.update(announcements).set({ enabled }).where(eq(announcements.id, id)).returning();
  return row ?? null;
}

export const moveAnnouncement = (id: number, direction: MoveDirection) => moveInOrder(announcements, id, direction, "desc");

export async function deleteAnnouncement(id: number): Promise<boolean> {
  const rows = await db.delete(announcements).where(eq(announcements.id, id)).returning({ id: announcements.id });
  return rows.length > 0;
}
