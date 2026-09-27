'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { updateItem } from '@/actions/items';
import { ItemFormFields, type ItemFormValues } from '@/components/items/ItemFormFields';
import { Button } from '@/components/ui/button';
import { SheetHeader } from '@/components/ui/sheet';
import { editableFieldsFor, formatTagInput, parseTagInput } from '@/lib/items';
import type { UpdateItemInput } from '@/lib/validation/items';
import type { CollectionOption } from '@/types/collection';
import type { ItemDetail } from '@/types/item';

interface ItemEditFormProps {
  item: ItemDetail;
  /** Every collection the user owns, for the collections picker. */
  collectionOptions: CollectionOption[];
  /** Whether AI tag suggestions are offered. */
  isPro: boolean;
  /** The drawer's identity block, so both modes show the same one. */
  heading: React.ReactNode;
  /** Handed the saved item, in full. */
  onSaved: (item: ItemDetail) => void;
  onCancel: () => void;
}

/**
 * The drawer in edit mode.
 *
 * Controlled inputs over local state rather than a form library, and no
 * optimistic write: the action returns the saved item in full, so the drawer
 * refreshes from the database's own answer instead of from what was typed.
 *
 * The form is `display: contents`, so the sheet's header and its scrolling body
 * keep the layout they have in view mode while both sit inside one form — which
 * is what lets the header's Save button submit the fields below it.
 */
export function ItemEditForm({
  item,
  collectionOptions,
  isPro,
  heading,
  onSaved,
  onCancel,
}: ItemEditFormProps) {
  const fields = editableFieldsFor(item.type.slug);

  const [values, setValues] = useState<ItemFormValues>(() => ({
    title: item.title,
    description: item.description ?? '',
    content: item.content ?? '',
    language: item.language ?? '',
    url: item.url ?? '',
    tags: formatTagInput(item.tags),
    collectionIds: item.collections.map((collection) => collection.id),
  }));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  // A basic guard only — the schema in the server action is what actually
  // decides, and it trims before it measures just like this does.
  const canSave = values.title.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: UpdateItemInput = {
      title: values.title,
      description: values.description,
      tags: parseTagInput(values.tags),
      collectionIds: values.collectionIds,
    };

    // Only the fields this type actually shows. Sending the rest would clear
    // whatever a previous type-specific edit had put there.
    if (fields.content) payload.content = values.content;
    if (fields.language) payload.language = values.language;
    if (fields.url) payload.url = values.url;

    startTransition(async () => {
      const result = await updateItem(item.id, payload);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);

        return;
      }

      setFieldErrors({});
      toast.success('Item updated');
      onSaved(result.data);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <SheetHeader className="gap-3 border-b p-6 pr-14">
        {heading}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending || !canSave}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
        <ItemFormFields
          idPrefix="item"
          size="drawer"
          slug={item.type.slug}
          typeName={item.type.name}
          fileName={item.fileName}
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          fieldErrors={fieldErrors}
          collectionOptions={collectionOptions}
          isPro={isPro}
          disabled={isPending}
        />
      </div>
    </form>
  );
}
