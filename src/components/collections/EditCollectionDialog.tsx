'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { updateCollection } from '@/actions/collections';
import { CollectionFields } from '@/components/collections/CollectionFields';
import { FormDialog, FormDialogBody } from '@/components/dialogs/FormDialog';
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
 * Controlled from outside, as every `FormDialog` is: the card's opener is a
 * `DropdownMenuItem`, and the page's button row and the card's menu share this
 * one dialog.
 */
export function EditCollectionDialog({
  collection,
  open,
  onOpenChange,
  onUpdated,
}: EditCollectionDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit collection"
      description="Change the name or description."
    >
      <EditCollectionForm
        collection={collection}
        onUpdated={onUpdated}
        onCancel={() => onOpenChange(false)}
      />
    </FormDialog>
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
    <FormDialogBody
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isPending={isPending}
      canSubmit={name.trim().length > 0}
      submitLabel="Save changes"
      pendingLabel="Saving…"
    >
      <CollectionFields
        idPrefix="edit-collection"
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        fieldErrors={fieldErrors}
      />
    </FormDialogBody>
  );
}
