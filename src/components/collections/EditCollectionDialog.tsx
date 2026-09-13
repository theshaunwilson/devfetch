'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { updateCollection } from '@/actions/collections';
import { CollectionFields } from '@/components/collections/CollectionFields';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CollectionMeta } from '@/types/collection';

interface EditCollectionDialogProps {
  collection: CollectionMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the collection has been saved. */
  onUpdated: () => void;
}

/**
 * Edits a collection's metadata.
 *
 * Controlled from outside rather than carrying its own trigger, unlike
 * `NewCollectionDialog`: the card's opener is a `DropdownMenuItem`, which
 * unmounts when the menu closes — so a dialog nested in one would be torn down
 * on the very click that opened it. Each call site renders its own trigger and
 * flips this open, which is also what lets the page's button row and the card's
 * menu share one dialog.
 *
 * The form is a child so it unmounts with the dialog: an abandoned edit and its
 * errors belong to the attempt that was dropped, not to the next open.
 */
export function EditCollectionDialog({
  collection,
  open,
  onOpenChange,
  onUpdated,
}: EditCollectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit collection</DialogTitle>
          <DialogDescription>Change the name or description.</DialogDescription>
        </DialogHeader>

        <EditCollectionForm
          collection={collection}
          onUpdated={onUpdated}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface EditCollectionFormProps {
  collection: CollectionMeta;
  onUpdated: () => void;
  onCancel: () => void;
}

function EditCollectionForm({ collection, onUpdated, onCancel }: EditCollectionFormProps) {
  const [name, setName] = useState(collection.name);
  // `null` is how an absent description is stored; a textarea needs a string.
  const [description, setDescription] = useState(collection.description ?? '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  // A guard for the button only — the action re-checks, and trims before it
  // measures just as this does.
  const canSave = name.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateCollection(collection.id, { name, description });

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);

        return;
      }

      toast.success('Collection updated');
      onUpdated();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Only the fields scroll, so the footer's buttons stay put — the same
          shape the create dialog needs on a short viewport. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        <CollectionFields
          idPrefix="edit-collection"
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          fieldErrors={fieldErrors}
        />
      </div>

      <DialogFooter className="shrink-0">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !canSave} className="w-full sm:w-auto">
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}
