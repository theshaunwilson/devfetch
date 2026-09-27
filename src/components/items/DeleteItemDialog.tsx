'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { deleteItem } from '@/actions/items';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
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
 * Owns its open state, unlike `DeleteCollectionDialog`: its trigger is an
 * ordinary button that stays mounted, so it can carry the dialog itself.
 */
export function DeleteItemDialog({ itemId, title, onDeleted }: DeleteItemDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
          <span className="sr-only">Delete</span>
        </Button>
      }
      title="Delete this item?"
      name={title}
      consequence="This cannot be undone."
      successMessage="Item deleted"
      onConfirm={() => deleteItem(itemId)}
      onDeleted={onDeleted}
    />
  );
}
