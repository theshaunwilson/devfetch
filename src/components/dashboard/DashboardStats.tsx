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
      iconClassName: 'text-blue-500',
    },
    {
      label: 'Collections',
      value: collections.total,
      icon: Folder,
      iconClassName: 'text-purple-500',
    },
    {
      label: 'Favorite Items',
      value: items.favorites,
      icon: Star,
      iconClassName: 'text-yellow-500',
    },
    {
      label: 'Favorite Collections',
      value: collections.favorites,
      icon: FolderHeart,
      iconClassName: 'text-pink-500',
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
