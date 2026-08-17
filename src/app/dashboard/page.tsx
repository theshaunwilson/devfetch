import type { Metadata } from 'next';
import { Clock, Pin } from 'lucide-react';
import { CollectionCard } from '@/components/dashboard/CollectionCard';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ItemRow } from '@/components/dashboard/ItemRow';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
import { collections, items } from '@/lib/mock-data';

export const metadata: Metadata = {
  title: 'Dashboard | Devfetch',
};

const RECENT_COLLECTION_LIMIT = 6;
const RECENT_ITEM_LIMIT = 10;

const byUpdatedAtDesc = (a: { updatedAt: string }, b: { updatedAt: string }) =>
  b.updatedAt.localeCompare(a.updatedAt);

const recentCollections = [...collections].sort(byUpdatedAtDesc).slice(0, RECENT_COLLECTION_LIMIT);

const pinnedItems = items.filter((item) => item.isPinned).sort(byUpdatedAtDesc);

const recentItems = [...items].sort(byUpdatedAtDesc).slice(0, RECENT_ITEM_LIMIT);

export default function DashboardPage() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Your developer knowledge hub</p>

      <div className="mt-8">
        <DashboardStats />
      </div>

      <section className="mt-10">
        <SectionHeader title="Collections" viewAllHref="/collections" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recentCollections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      </section>

      {pinnedItems.length > 0 && (
        <section className="mt-10">
          <SectionHeader title="Pinned" icon={Pin} />
          <div className="flex flex-col gap-3">
            {pinnedItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <SectionHeader title="Recent" icon={Clock} viewAllHref="/items" />
        <div className="flex flex-col gap-3">
          {recentItems.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
