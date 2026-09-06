import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ItemCard } from '@/components/items/ItemCard';
import { NewItemDialog } from '@/components/items/NewItemDialog';
import { getItemsByTypeSlug, getItemTypes } from '@/lib/db/items';
import { capitalize } from '@/lib/format';
import { isProType } from '@/lib/pro';

// Reads the signed-in user's items per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/items/[type]'>): Promise<Metadata> {
  const { type } = await params;
  const result = await getItemsByTypeSlug(type);

  // An unknown slug renders notFound() below; the generic title covers it.
  return { title: result ? `${capitalize(result.type.name)} | Devfetch` : 'Items | Devfetch' };
}

export default async function ItemsByTypePage({ params }: PageProps<'/items/[type]'>) {
  const { type } = await params;
  const result = await getItemsByTypeSlug(type);

  // A slug naming no visible type is a 404, so a typo reads differently from a
  // type that simply holds nothing.
  if (!result) {
    notFound();
  }

  const { items } = result;
  const typeName = capitalize(result.type.name);

  // `type` is the resolved type's own slug, not just what was requested: the
  // lookup filters on it, so a row that came back matched it exactly.
  //
  // File and Image cannot be created until uploads exist, so this page offers
  // no button rather than one that would open on a different type than the
  // page it sits on.
  const canCreate = !isProType(type);

  // Free: `getItemTypes` is request-cached and `AppShell` has already called
  // it for the sidebar.
  const itemTypes = canCreate ? await getItemTypes() : [];

  return (
    <div className="px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{typeName}</h1>
          <p className="mt-1 text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        {canCreate && (
          <NewItemDialog
            itemTypes={itemTypes}
            defaultTypeSlug={type}
            triggerLabel={`New ${typeName}`}
          />
        )}
      </div>

      {items.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">No items of this type yet.</p>
      )}
    </div>
  );
}
