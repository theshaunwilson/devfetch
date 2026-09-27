'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createCollection } from '@/actions/collections';
import { CollectionFields } from '@/components/collections/CollectionFields';
import { FormDialog, FormDialogBody } from '@/components/dialogs/FormDialog';
import { useFailureToast } from '@/hooks/use-upgrade-toast';

interface NewCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the collection has been created. */
  onCreated: () => void;
}

/**
 * The new-collection form, in a dialog.
 *
 * Controlled from outside, as every `FormDialog` is — which is also what made
 * creating a collection reachable on a phone: it used to be a
 * `hidden md:inline-flex` button, because the top bar had no room for a second
 * labelled button beside search and New Item.
 */
export function NewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: NewCollectionDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New collection"
      description="Group related items under one name."
    >
      <NewCollectionForm onCreated={onCreated} onCancel={() => onOpenChange(false)} />
    </FormDialog>
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
  const failureToast = useFailureToast();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createCollection({ name, description });

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        // The collection ceiling is a Pro wall rather than a failure, so it
        // gets the upgrade alert — the same split the item dialog makes.
        failureToast(result);

        return;
      }

      toast.success('Collection created');
      onCreated();
    });
  }

  return (
    <FormDialogBody
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isPending={isPending}
      canSubmit={name.trim().length > 0}
      submitLabel="Create collection"
      pendingLabel="Creating…"
    >
      <CollectionFields
        idPrefix="new-collection"
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        fieldErrors={fieldErrors}
      />
    </FormDialogBody>
  );
}
