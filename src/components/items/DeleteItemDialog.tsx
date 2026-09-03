'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { deleteItem } from '@/actions/items';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeleteItemDialogProps {
  itemId: string;
  /** Named in the confirmation, so the click is about this item and not "an item". */
  title: string;
  /** Called once the row is gone. */
  onDeleted: () => void;
}

/**
 * The drawer's Delete button and the confirmation that guards it.
 *
 * Deleting is not undoable and there is no trash to recover from, so it is a
 * two-step action. The dialog owns its own open state rather than closing on
 * the confirm click, because the delete has to finish first.
 */
export function DeleteItemDialog({ itemId, title, onDeleted }: DeleteItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteItem(itemId);

      if (!result.success) {
        toast.error(result.error);
        setOpen(false);

        return;
      }

      toast.success('Item deleted');
      setOpen(false);
      onDeleted();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent
        // Nothing dismisses the dialog while the delete is in flight: closing
        // it would unmount the button mid-request and leave the result with
        // nowhere to land.
        onEscapeKeyDown={(event) => isPending && event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          {/* `wrap-anywhere`, not `break-words`: the title is the user's own
              text and can have no break opportunity in it at all, and
              `overflow-wrap: break-word` does not reduce a box's min-content
              width — so inside the dialog's grid the paragraph still grew past
              its edge. Measured at 964px in a 320px dialog before this. */}
          <AlertDialogDescription className="wrap-anywhere">
            <span className="font-medium text-foreground">{title}</span> will be permanently
            deleted. This cannot be undone.
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
