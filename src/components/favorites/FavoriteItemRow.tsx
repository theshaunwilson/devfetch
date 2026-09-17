import { FavoriteRow } from '@/components/favorites/FavoriteRow';
import { OpenItemButton } from '@/components/items/OpenItemButton';
import { capitalize } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import type { DashboardItem } from '@/types/item';

/**
 * A favorited item. Clicking anywhere on the row opens the detail drawer,
 * exactly as a card does — the whole `DashboardItem` is carried here for that
 * reason, since `openItem` takes the row rather than an id.
 */
export function FavoriteItemRow({ item }: { item: DashboardItem }) {
  const { type } = item;

  return (
    <FavoriteRow
      icon={getIcon(type.icon)}
      color={type.color}
      title={item.title}
      // Seeded type names are lowercase singular; the UI capitalizes them.
      badge={capitalize(type.name)}
      date={item.updatedAt}
    >
      <OpenItemButton item={item} className="rounded-none" />
    </FavoriteRow>
  );
}
