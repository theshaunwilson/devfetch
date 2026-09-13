'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { deleteCollection } from '@/actions/collections';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

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
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteCollection(collectionId);

      if (!result.success) {
        toast.error(result.error);
        onOpenChange(false);

        return;
      }

      toast.success('Collection deleted');
      onOpenChange(false);
      onDeleted();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // Nothing dismisses the dialog while the delete is in flight: closing it
        // would unmount the button mid-request and leave the result with nowhere
        // to land. Radix already refuses an outside click here, so Escape is the
        // only route left to block.
        onEscapeKeyDown={(event) => isPending && event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
          {/* `wrap-anywhere`, not `break-words`: the name is the user's own text
              and can have no break opportunity in it at all, and
              `overflow-wrap: break-word` does not reduce a box's min-content
              width — so inside the dialog's grid the paragraph still grows past
              its edge. The item confirmation measured 964px in a 320px dialog
              before this. */}
          <AlertDialogDescription className="wrap-anywhere">
            <span className="font-medium text-foreground">{name}</span> will be permanently deleted.
            The items in it are not deleted — they will just no longer be in this collection.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/* A plain button, not `AlertDialogAction`: that closes the dialog on
              click, which would unmount this component's transition. */}
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
