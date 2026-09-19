'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { NewItemDialog } from '@/components/items/NewItemDialog';
import { Button } from '@/components/ui/button';
import type { CollectionOption } from '@/types/collection';
import type { SidebarItemType } from '@/types/item';

interface NewItemButtonProps {
  itemTypes: SidebarItemType[];
  collectionOptions: CollectionOption[];
  /** Which type the form opens on. */
  defaultTypeSlug?: string;
  /** The trigger's text, for a caller that creates one specific type. */
  label?: string;
}

/**
 * A labelled button that opens the new-item dialog.
 *
 * Exists because `NewItemDialog` is controlled and carries no trigger of its
 * own, and the items page that renders this is a server component, so the open
 * state has to live in a client component somewhere. The top bar opens the
 * same dialog from its `+` menu instead.
 */
export function NewItemButton({
  itemTypes,
  collectionOptions,
  defaultTypeSlug,
  label = 'New Item',
}: NewItemButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button className="h-10" disabled={itemTypes.length === 0} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {label}
      </Button>

      <NewItemDialog
        itemTypes={itemTypes}
        collectionOptions={collectionOptions}
        defaultTypeSlug={defaultTypeSlug}
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          setOpen(false);
          // Catches up the server-rendered lists behind the dialog — the stat
          // tiles, Pinned and Recent, and the items grid.
          router.refresh();
        }}
      />
    </>
  );
}
