import { Folder, FolderHeart, Layers, Star } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import type { CollectionStats } from '@/types/collection';
import type { ItemStats } from '@/types/item';

interface DashboardStatsProps {
  items: ItemStats;
  collections: CollectionStats;
}

/** Four count tiles at the top of the dashboard. */
export function DashboardStats({ items, collections }: DashboardStatsProps) {
  const stats = [
    {
      label: 'Items',
      value: items.total,
      icon: Layers,
      iconClassName: 'text-primary',
    },
    {
      label: 'Collections',
      value: collections.total,
      icon: Folder,
      iconClassName: 'text-brand-alt',
    },
    {
      label: 'Favorite Items',
      value: items.favorites,
      icon: Star,
      iconClassName: 'text-favorite',
    },
    {
      label: 'Favorite Collections',
      value: collections.favorites,
      icon: FolderHeart,
      iconClassName: 'text-favorite',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          iconClassName={stat.iconClassName}
        />
      ))}
    </div>
  );
}
