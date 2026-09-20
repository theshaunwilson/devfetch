'use client';

import { FolderPlus, Plus, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { NewCollectionDialog } from '@/components/collections/NewCollectionDialog';
import { NewItemDialog } from '@/components/items/NewItemDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CollectionOption } from '@/types/collection';
import type { SidebarItemType } from '@/types/item';

interface CreateMenuProps {
  itemTypes: SidebarItemType[];
  collectionOptions: CollectionOption[];
}

/**
 * The top bar's create controls, in two shapes.
 *
 * Below `lg` it is one `+` button opening a menu, which is what makes creating
 * a collection reachable on a phone: the labelled "New Collection" button was
 * `hidden md:inline-flex`, because the bar has no room for a second label at
 * that width. From `lg` up the two labelled buttons are back, since there the
 * bar has the room and a named button beats a menu you have to open first.
 *
 * The two shapes share one pair of dialogs and one pair of state variables, so
 * there is no second copy of the create wiring to drift — only the triggers
 * differ.
 *
 * Both dialogs are siblings of the menu rather than children of its items: a
 * `DropdownMenuItem` unmounts when the menu closes, which would tear a nested
 * dialog down on the click that opened it. `CollectionCardMenu` is built the
 * same way for the same reason.
 */
export function CreateMenu({ itemTypes, collectionOptions }: CreateMenuProps) {
  const [itemOpen, setItemOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* The default (filled) variant, so it keeps the white box the
              labelled button had — only the label is gone. */}
          <Button size="icon" className="size-10 lg:hidden">
            <Plus className="size-4" />
            <span className="sr-only">Create</span>
          </Button>
        </DropdownMenuTrigger>

        {/* Wider than the 8rem default, which wrapped "New Collection" onto a
            second line. */}
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            disabled={itemTypes.length === 0}
            onSelect={() => setItemOpen(true)}
          >
            <FileText className="size-4" />
            New Item
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setCollectionOpen(true)}>
            <FolderPlus className="size-4" />
            New Collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* The same two actions the menu holds, as their own buttons. They open
          the very same dialogs, so nothing here duplicates the create flow. */}
      <Button
        variant="outline"
        className="hidden h-10 lg:inline-flex"
        onClick={() => setCollectionOpen(true)}
      >
        <FolderPlus className="size-4" />
        New Collection
      </Button>

      <Button
        className="hidden h-10 lg:inline-flex"
        disabled={itemTypes.length === 0}
        onClick={() => setItemOpen(true)}
      >
        <Plus className="size-4" />
        New Item
      </Button>

      <NewItemDialog
        itemTypes={itemTypes}
        collectionOptions={collectionOptions}
        open={itemOpen}
        onOpenChange={setItemOpen}
        onCreated={() => {
          setItemOpen(false);
          // Catches up the server-rendered lists behind the dialog — the stat
          // tiles, Pinned and Recent, and the items grid.
          router.refresh();
        }}
      />

      <NewCollectionDialog
        open={collectionOpen}
        onOpenChange={setCollectionOpen}
        onCreated={() => {
          setCollectionOpen(false);
          // Catches up everything the new collection lands in. `AppShell` and
          // `/dashboard` are both `force-dynamic`, so one refresh re-renders
          // the layout as well as the page: the sidebar's Favorites and Recent
          // lists, the Collections grid and both collection stat tiles.
          router.refresh();
        }}
      />
    </>
  );
}
