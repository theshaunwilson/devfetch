'use client';

import { deleteCollection } from '@/actions/collections';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';

interface DeleteCollectionDialogProps {
  collectionId: string;
  /** Named in the confirmation, so the click is about this collection. */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the collection is gone. */
  onDeleted: () => void;
}

/**
 * Confirms deleting a collection.
 *
 * Controlled from outside, for the same reason `EditCollectionDialog` is: the
 * card's opener is a menu item that unmounts with its menu.
 *
 * The confirmation says the items survive, because that is the question a user
 * is actually asking at this point and the answer is not obvious — the
 * collection goes, the items stay and simply end up filed somewhere else or
 * nowhere. `ItemCollection.collection` is `onDelete: Cascade`, so only the
 * filings are removed; nothing here writes an `Item`.
 */
export function DeleteCollectionDialog({
  collectionId,
  name,
  open,
  onOpenChange,
  onDeleted,
}: DeleteCollectionDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this collection?"
      name={name}
      consequence="The items in it are not deleted — they will just no longer be in this collection."
      successMessage="Collection deleted"
      onConfirm={() => deleteCollection(collectionId)}
      onDeleted={onDeleted}
    />
  );
}
