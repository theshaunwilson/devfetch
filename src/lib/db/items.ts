import { getCurrentUserId } from '@/lib/db/user';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { DashboardItem, ItemStats } from '@/types/item';

/** Everything an item row renders: type for the icon and border, plus tags. */
const ITEM_SELECT = {
  id: true,
  title: true,
  description: true,
  isFavorite: true,
  isPinned: true,
  updatedAt: true,
  type: { select: { id: true, name: true, icon: true, color: true } },
  tags: {
    select: { tag: { select: { name: true } } },
    // Join rows have no natural order, so sort for a stable badge order.
    orderBy: { tag: { name: 'asc' } },
  },
} satisfies Prisma.ItemSelect;

type ItemPayload = Prisma.ItemGetPayload<{ select: typeof ITEM_SELECT }>;

function toDashboardItem(item: ItemPayload): DashboardItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    isFavorite: item.isFavorite,
    isPinned: item.isPinned,
    updatedAt: item.updatedAt.toISOString(),
    type: item.type,
    tags: item.tags.map((itemTag) => itemTag.tag.name),
  };
}

/**
 * Every pinned item, most recently updated first. Not limited — pinning is a
 * deliberate act, so the list is expected to stay short.
 */
export async function getPinnedItems(): Promise<DashboardItem[]> {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { updatedAt: 'desc' },
    select: ITEM_SELECT,
  });

  return items.map(toDashboardItem);
}

/** Most recently updated items, whether pinned or not. */
export async function getRecentItems(limit: number): Promise<DashboardItem[]> {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: ITEM_SELECT,
  });

  return items.map(toDashboardItem);
}

/** Item counts for the dashboard stat tiles. */
export async function getItemStats(): Promise<ItemStats> {
  const userId = await getCurrentUserId();

  if (!userId) return { total: 0, favorites: 0 };

  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}
