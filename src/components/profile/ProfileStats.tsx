import { Folder, Layers } from 'lucide-react';

import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getIcon } from '@/lib/icons';
import { softBgColorClass, textColorClass } from '@/lib/colors';
import type { CollectionStats } from '@/types/collection';
import type { ItemStats, SidebarItemType } from '@/types/item';

interface ProfileStatsProps {
  items: ItemStats;
  collections: CollectionStats;
  /** Every type available to the user, each with its own item count. */
  itemTypes: SidebarItemType[];
}

/** Totals, then the per-type breakdown underneath them. */
export function ProfileStats({ items, collections, itemTypes }: ProfileStatsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Items" value={items.total} icon={Layers} iconClassName="text-blue-500" />
        <StatCard
          label="Collections"
          value={collections.total}
          icon={Folder}
          iconClassName="text-purple-500"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items by type</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-2 sm:grid-cols-2">
          {itemTypes.map((type) => {
            const Icon = getIcon(type.icon);

            return (
              <div key={type.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-md ${softBgColorClass(type.color)}`}
                >
                  <Icon className={`size-4 ${textColorClass(type.color)}`} />
                </span>

                {/* Seeded type names are lowercase singular, capitalized at
                    render exactly as the sidebar does. */}
                <span className="min-w-0 flex-1 truncate text-sm capitalize">{type.name}</span>

                <span className="text-sm font-medium tabular-nums">{type.itemCount}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
