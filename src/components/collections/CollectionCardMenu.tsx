'use client';

import { MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DeleteCollectionDialog } from '@/components/collections/DeleteCollectionDialog';
import { EditCollectionDialog } from '@/components/collections/EditCollectionDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CollectionMeta } from '@/types/collection';

interface CollectionCardMenuProps {
  collection: CollectionMeta;
  isFavorite: boolean;
}

/**
 * The "…" menu on a collection card, holding the same three actions the
 * collection's own page offers.
 *
 * Sits at `relative z-20`, above the card's `absolute inset-0 z-10` link
 * overlay, rather than stopping propagation: the overlay is a sibling rather
 * than a wrapper, so a click here is never a click on the link and there is
 * nothing to stop. That is the mechanic `FileRow`'s Download button and
 * `CopyItemButton` both use.
 *
 * The dialogs are siblings of the menu, not children of its items: a
 * `DropdownMenuItem` unmounts when the menu closes, which would tear a nested
 * dialog down on the click that opened it.
 */
export function CollectionCardMenu({ collection, isFavorite }: CollectionCardMenuProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative z-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions for {collection.name}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {/* Inert, as on the collection's own page: favouriting needs a
              mutation that does not exist yet. The state still renders, since
              it comes from the collection itself. */}
          <DropdownMenuItem>
            <Star className={cn('size-4', isFavorite && 'fill-yellow-500 text-yellow-500')} />
            Favorite
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCollectionDialog
        collection={collection}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={() => {
          setEditOpen(false);
          // The card is server-rendered, so the list it sits in redraws with the
          // new name — and so does the sidebar, `AppShell` being `force-dynamic`.
          router.refresh();
        }}
      />

      <DeleteCollectionDialog
        collectionId={collection.id}
        name={collection.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        // No navigation: the card's own list is the page the user is already on.
        onDeleted={() => router.refresh()}
      />
    </div>
  );
}
