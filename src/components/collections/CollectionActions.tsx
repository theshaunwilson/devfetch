'use client';

import { Pencil, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { setCollectionFavorite } from '@/actions/collections';
import { DeleteCollectionDialog } from '@/components/collections/DeleteCollectionDialog';
import { EditCollectionDialog } from '@/components/collections/EditCollectionDialog';
import { Button } from '@/components/ui/button';
import { useFlagToggle } from '@/hooks/use-flag-toggle';
import { cn } from '@/lib/utils';
import type { CollectionMeta } from '@/types/collection';

interface CollectionActionsProps {
  collection: CollectionMeta;
  isFavorite: boolean;
}

/**
 * The action row on a collection's own page.
 *
 * Edit and delete open dialogs held here rather than nested in their triggers,
 * so the same two components serve this row and the card menu.
 */
export function CollectionActions({ collection, isFavorite }: CollectionActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  // This page is server-rendered, so the refresh the toggle issues is what
  // brings the confirmed value back — no client state to keep in step, unlike
  // the item drawer.
  const favorite = useFlagToggle({
    id: collection.id,
    value: isFavorite,
    setValue: setCollectionFavorite,
  });

  function handleDeleted() {
    // `replace`, not `push`: this page is about a collection that no longer
    // exists, so Back must not return to a route that now 404s. The refresh
    // that follows catches up the sidebar, which lives in the layout.
    router.replace('/collections');
    router.refresh();
  }

  return (
    // Wraps rather than overflows: buttons are `shrink-0`, so on a narrow screen
    // the row would otherwise run past the page's edge.
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={favorite.toggle}
        aria-pressed={favorite.value}
      >
        <Star className={cn('size-4', favorite.value && 'fill-yellow-500 text-yellow-500')} />
        Favorite
      </Button>

      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" />
        Edit
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
        Delete
      </Button>

      <EditCollectionDialog
        collection={collection}
        open={editOpen}
        onOpenChange={setEditOpen}
        // The page re-renders from the database, so the new name reaches the
        // heading, the sidebar and every card without anything being passed back.
        onUpdated={() => {
          setEditOpen(false);
          router.refresh();
        }}
      />

      <DeleteCollectionDialog
        collectionId={collection.id}
        name={collection.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
