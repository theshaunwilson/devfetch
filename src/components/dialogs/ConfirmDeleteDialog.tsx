'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

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
import type { ActionResult } from '@/types/action';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional: a caller opening this from a menu item renders its trigger elsewhere. */
  trigger?: React.ReactNode;
  /** "Delete this item?" */
  title: string;
  /** The user's own name for the thing, so the click is about this one and not "an item". */
  name: string;
  /** What deleting it means, after "<name> will be permanently deleted." */
  consequence: string;
  successMessage: string;
  onConfirm: () => Promise<ActionResult>;
  /** Called once the row is gone. */
  onDeleted: () => void;
}

/**
 * The confirmation that guards a delete. There is no trash to recover from, so
 * deleting is always two steps.
 *
 * Stays open through the request rather than closing on the confirm click,
 * because the delete has to finish first.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  trigger,
  title,
  name,
  consequence,
  successMessage,
  onConfirm,
  onDeleted,
}: ConfirmDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm();

      if (!result.success) {
        toast.error(result.error);
        onOpenChange(false);

        return;
      }

      toast.success(successMessage);
      onOpenChange(false);
      onDeleted();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}

      <AlertDialogContent
        // Nothing dismisses the dialog while the delete is in flight: closing it
        // would unmount the button mid-request and leave the result with nowhere
        // to land. Radix already refuses an outside click here, so Escape is the
        // only route left to block.
        onEscapeKeyDown={(event) => isPending && event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* `wrap-anywhere`, not `break-words`: the name is the user's own text
              and can have no break opportunity in it at all, and
              `overflow-wrap: break-word` does not reduce a box's min-content
              width — so inside the dialog's grid the paragraph still grew past
              its edge. Measured at 964px in a 320px dialog before this. */}
          <AlertDialogDescription className="wrap-anywhere">
            <span className="font-medium text-foreground">{name}</span> will be permanently deleted.{' '}
            {consequence}
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
