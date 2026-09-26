'use client';

import { TypeIconTile } from '@/components/items/TypeIconTile';
import { ItemDrawerActions } from '@/components/items/ItemDrawerActions';
import { ItemDrawerBody } from '@/components/items/ItemDrawerBody';
import { ItemEditForm } from '@/components/items/ItemEditForm';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { capitalize } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import type { CollectionOption } from '@/types/collection';
import type { DashboardItem, ItemDetail, ItemDetailStatus, ItemDrawerMode } from '@/types/item';

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  /** The card's own data — present as soon as the drawer opens. */
  item: DashboardItem | null;
  /** The full item, once the request comes back. */
  detail: ItemDetail | null;
  /** Every collection the user owns, for edit mode's picker. */
  collectionOptions: CollectionOption[];
  /** Whether the AI features — edit mode's suggestions, view mode's code explanation and prompt optimization — are live. */
  isPro: boolean;
  status: ItemDetailStatus;
  mode: ItemDrawerMode;
  onModeChange: (mode: ItemDrawerMode) => void;
  /** Called with the saved item after an edit, or after an optimized prompt is accepted. */
  onSaved: (item: ItemDetail) => void;
  /** Called once the item has been deleted. */
  onDeleted: () => void;
  /** Called with the new value once the star has been written. */
  onFavoriteChanged: (isFavorite: boolean) => void;
  /** As `onFavoriteChanged`, for the pin. */
  onPinChanged: (isPinned: boolean) => void;
}

/**
 * Item detail view, as a right-hand drawer. There is no item page — this is it.
 *
 * Everything the card already knew is drawn immediately; only the fields that
 * arrive from `/api/items/[id]` wait behind a skeleton, so opening the drawer
 * never shows an empty panel.
 *
 * Editing happens in the same drawer: the action bar becomes Save and Cancel
 * and the fields become inputs, which is why `ItemEditForm` renders its own
 * header rather than only a body.
 */
export function ItemDrawer({
  open,
  onOpenChange,
  onCloseAutoFocus,
  item,
  detail,
  collectionOptions,
  isPro,
  status,
  mode,
  onModeChange,
  onSaved,
  onDeleted,
  onFavoriteChanged,
  onPinChanged,
}: ItemDrawerProps) {
  // Edit needs the fields only the detail request carries, so it cannot open
  // until that has landed.
  const editing = mode === 'edit' && detail !== null;

  const heading = item && (
    <div className="flex items-start gap-3">
      <TypeIconTile icon={getIcon(item.type.icon)} color={item.type.color} />

      <div className="min-w-0 flex-1">
        <SheetTitle className="text-lg break-words">{item.title}</SheetTitle>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{capitalize(item.type.name)}</Badge>
          {!editing && status === 'loading' && <Skeleton className="h-5 w-20 rounded-4xl" />}
          {/* Hidden while editing: the language has its own input below, and a
              badge beside it would go stale as soon as it was typed in. */}
          {!editing && detail?.language && <Badge variant="outline">{detail.language}</Badge>}
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onCloseAutoFocus={onCloseAutoFocus}
        // Both widths carry the sheet's own `data-[side=right]:` prefix. A
        // plain `w-full sm:max-w-lg` is a different variant, so it loses to
        // the base `w-3/4 sm:max-w-sm` rather than overriding it.
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        // The title alone describes the drawer; there is no summary line to
        // point `aria-describedby` at.
        aria-describedby={undefined}
      >
        {item &&
          (editing && detail ? (
            <ItemEditForm
              // Remounts on a different item, so the inputs re-seed from it
              // rather than keeping what was typed against the previous one.
              key={detail.id}
              item={detail}
              collectionOptions={collectionOptions}
              isPro={isPro}
              heading={heading}
              onSaved={onSaved}
              onCancel={() => onModeChange('view')}
            />
          ) : (
            <>
              <SheetHeader className="gap-3 border-b p-6 pr-14">
                {heading}

                <ItemDrawerActions
                  itemId={item.id}
                  title={item.title}
                  isFavorite={item.isFavorite}
                  isPinned={item.isPinned}
                  onEdit={() => onModeChange('edit')}
                  canEdit={detail !== null}
                  onDeleted={onDeleted}
                  onFavoriteChanged={onFavoriteChanged}
                  onPinChanged={onPinChanged}
                />
              </SheetHeader>

              <ItemDrawerBody
                item={item}
                detail={detail}
                status={status}
                isPro={isPro}
                onSaved={onSaved}
              />
            </>
          ))}
      </SheetContent>
    </Sheet>
  );
}
