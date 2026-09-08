// Fails the build if a client component imports this. Not in `@/lib/prisma`,
// which the tsx scripts import, where `server-only` throws.
import 'server-only';

import { cache } from 'react';

import { getCurrentUserId } from '@/lib/db/user';
import { prisma } from '@/lib/prisma';
import type { ItemTypeRef, SidebarItemType } from '@/types/item';

/**
 * The item types one user may see or use: the global system types plus their
 * own custom ones.
 *
 * System types are global — `userId: null` — so a plain `userId` filter would
 * match none of the seven built-ins. The `OR` is also the check that stops one
 * user filing an item under another user's custom type, which is why it is
 * written once here rather than at each call site.
 */
export function visibleItemTypeFilter(userId: string) {
  return { OR: [{ userId: null }, { userId }] };
}

/**
 * One item type the current user is allowed to file an item under — a global
 * system type or a custom type of their own.
 *
 * The id arrives from the client, so this is the check that stops an item being
 * attached to somebody else's custom type. Returns null when the id names no
 * such type, which reads the same either way. The slug comes back because the
 * caller needs it to decide which fields the type requires.
 */
export async function getItemTypeById(id: string): Promise<ItemTypeRef | null> {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  // findFirst, not findUnique: the ownership filter is what makes this safe,
  // and findUnique would accept the id on its own.
  return prisma.itemType.findFirst({
    where: { id, ...visibleItemTypeFilter(userId) },
    select: { id: true, slug: true },
  });
}

/**
 * Item types available to the current user — the global system types plus any
 * custom types they own — each with how many of their items use it.
 *
 * Ordered by creation so the built-in types keep the order they were seeded in,
 * with custom types appended after them.
 *
 * `cache`d because more than one place needs the list per request: `AppShell`
 * for the sidebar, and the items page for its own create button. Without it
 * they would each pay for the findMany and the groupBy.
 */
export const getItemTypes = cache(async (): Promise<SidebarItemType[]> => {
  const userId = await getCurrentUserId();

  if (!userId) return [];

  const [types, usage] = await Promise.all([
    prisma.itemType.findMany({
      where: visibleItemTypeFilter(userId),
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, icon: true, color: true },
    }),
    // Counting in the database keeps the item rows out of the response.
    prisma.item.groupBy({
      by: ['typeId'],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const countByType = new Map(usage.map((row) => [row.typeId, row._count._all]));

  return types.map((type) => ({
    ...type,
    itemCount: countByType.get(type.id) ?? 0,
  }));
});
