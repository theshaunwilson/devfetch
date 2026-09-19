'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createCollection } from '@/actions/collections';
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

interface NewCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the collection has been created. */
  onCreated: () => void;
}

/**
 * The new-collection form, in a dialog.
 *
 * Controlled from outside rather than carrying its own trigger, the way
 * `EditCollectionDialog` is and for the same reason: the top bar opens it from
 * a `DropdownMenuItem`, which unmounts when the menu closes, and a dialog
 * nested in one would be torn down on the very click that opened it.
 *
 * Moving the trigger out is also what made creating a collection reachable on
 * a phone: it used to be a `hidden md:inline-flex` button, because the top bar
 * had no room for a second labelled button beside search and New Item.
 *
 * The form lives in a child so it unmounts with the dialog: a half-typed
 * collection and its errors belong to the attempt that was abandoned, not to
 * the next one — the same reason `NewItemDialog` is built this way.
 */
export function NewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: NewCollectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>Group related items under one name.</DialogDescription>
        </DialogHeader>

        <NewCollectionForm onCreated={onCreated} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface NewCollectionFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

function NewCollectionForm({ onCreated, onCancel }: NewCollectionFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  // A guard for the button only — the action re-checks, and trims before it
  // measures just as this does.
  const canSave = name.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createCollection({ name, description });

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);

        return;
      }

      toast.success('Collection created');
      onCreated();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Only the fields scroll, so the footer's buttons stay put — the same
          shape as the item dialog, which needs it on a short viewport. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        <CollectionFields
          idPrefix="new-collection"
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
          {isPending ? 'Creating…' : 'Create collection'}
        </Button>
      </DialogFooter>
    </form>
  );
}
