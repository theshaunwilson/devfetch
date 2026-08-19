import { Folder, FolderHeart, Layers, Star } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import type { CollectionStats } from '@/types/collection';
import { items } from '@/lib/mock-data';

interface DashboardStatsProps {
  collections: CollectionStats;
}

/** Four count tiles at the top of the dashboard. */
export function DashboardStats({ collections }: DashboardStatsProps) {
  // Item counts still come from mock data — items move to the database next.
  const stats = [
    {
      label: 'Items',
      value: items.length,
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
      value: items.filter((item) => item.isFavorite).length,
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
