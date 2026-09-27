'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createItem } from '@/actions/items';
import { FormDialog, FormDialogBody } from '@/components/dialogs/FormDialog';
import { FileUpload } from '@/components/items/FileUpload';
import { ItemFieldError } from '@/components/items/ItemFieldError';
import { ItemFormFields, type ItemFormValues } from '@/components/items/ItemFormFields';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFailureToast } from '@/hooks/use-upgrade-toast';
import { textColorClass } from '@/lib/colors';
import { capitalize } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { buildCreateItemPayload, initialTypeId, requiredFieldsFor } from '@/lib/items';
import { canCreateType } from '@/lib/pro';
import { isImageUploadType } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import type { CollectionOption } from '@/types/collection';
import type { SidebarItemType } from '@/types/item';
import type { UploadedFile } from '@/types/upload';

const EMPTY_VALUES: ItemFormValues = {
  title: '',
  description: '',
  content: '',
  language: '',
  url: '',
  tags: '',
  collectionIds: [],
};

interface NewItemDialogProps {
  /** Every type the user can see. Pro ones are shown disabled, never removed. */
  itemTypes: SidebarItemType[];
  /** Decides whether the two upload types can be picked. */
  isPro: boolean;
  /** Every collection the user owns, for the collections picker. */
  collectionOptions: CollectionOption[];
  /**
   * Which type the form opens on. Falls back to the first offered type when
   * absent or when the slug names a type that cannot be created — so a caller
   * cannot leave the selector on nothing.
   */
  defaultTypeSlug?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the item has been created. */
  onCreated: () => void;
}

/**
 * The new-item form, in a dialog.
 *
 * Controlled from outside, as every `FormDialog` is, which is what lets the top
 * bar's `+` menu and the items page's labelled button share one dialog. The
 * form unmounts with the dialog, which is also what re-applies
 * `defaultTypeSlug` on every open rather than leaving the selector wherever
 * the last abandoned attempt left it.
 */
export function NewItemDialog({
  itemTypes,
  isPro,
  collectionOptions,
  defaultTypeSlug,
  open,
  onOpenChange,
  onCreated,
}: NewItemDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New item"
      description="Pick a type — the fields below follow from it."
    >
      <NewItemForm
        types={itemTypes}
        isPro={isPro}
        collectionOptions={collectionOptions}
        defaultTypeSlug={defaultTypeSlug}
        onCreated={onCreated}
        onCancel={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}

interface NewItemFormProps {
  /** Never empty: the trigger is disabled when there is nothing to pick. */
  types: SidebarItemType[];
  isPro: boolean;
  collectionOptions: CollectionOption[];
  defaultTypeSlug?: string;
  onCreated: () => void;
  onCancel: () => void;
}

function NewItemForm({
  types,
  isPro,
  collectionOptions,
  defaultTypeSlug,
  onCreated,
  onCancel,
}: NewItemFormProps) {
  const [typeId, setTypeId] = useState(() => initialTypeId(types, defaultTypeSlug, isPro));
  const [values, setValues] = useState<ItemFormValues>(EMPTY_VALUES);
  const [file, setFile] = useState<UploadedFile | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const failureToast = useFailureToast();

  // Falls back to the first type only to keep the slug a string; the selected
  // id always names one of these, since it can only come from the list.
  const selected = types.find((type) => type.id === typeId) ?? types[0];
  const required = requiredFieldsFor(selected.slug);
  const fileLabel = isImageUploadType(selected.slug) ? 'Image' : 'File';

  // A guard for the button only — the action re-checks both, and trims before
  // it measures just as this does.
  const canSave =
    values.title.trim().length > 0 &&
    (!required.url || values.url.trim().length > 0) &&
    (!required.file || file !== null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildCreateItemPayload({ ...values, typeId, slug: selected.slug, file });

    startTransition(async () => {
      const result = await createItem(payload);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        // A Pro wall reads as its own alert, not as a failure. The server
        // decides which refusals those are — see `upgradeRequired` on
        // `CreateItemResult`.
        failureToast(result);

        return;
      }

      toast.success('Item created');
      onCreated();
    });
  }

  return (
    <FormDialogBody
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isPending={isPending}
      canSubmit={canSave}
      submitLabel="Create item"
      pendingLabel="Creating…"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-item-type">Type</Label>
        <Select
          value={typeId}
          onValueChange={(next) => {
            setTypeId(next);
            // The upload belongs to the type it was made for: an image
            // already sent is not a valid file item, and the limits differ.
            setFile(null);
          }}
        >
          <SelectTrigger id="new-item-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((type) => {
              const Icon = getIcon(type.icon);
              // Disabled rather than removed: a feature nobody can see is a
              // feature nobody can be sold. The hint says why the row will
              // not take a click.
              const locked = !canCreateType(type.slug, isPro);

              return (
                <SelectItem key={type.id} value={type.id} disabled={locked}>
                  <Icon className={cn('size-4', textColorClass(type.color))} />
                  {capitalize(type.name)}
                  {locked && (
                    <span className="ml-auto pl-3 text-[10px] tracking-wider text-muted-foreground">
                      PRO
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <ItemFieldError messages={fieldErrors.typeId} />
        {!isPro && (
          <p className="text-xs text-muted-foreground">
            File and image uploads are a Pro feature.{' '}
            <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
              Upgrade
            </Link>{' '}
            to add them.
          </p>
        )}
      </div>

      <ItemFormFields
        idPrefix="new-item"
        size="dialog"
        slug={selected.slug}
        typeName={selected.name}
        fileName={file?.fileName ?? null}
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        fieldErrors={fieldErrors}
        collectionOptions={collectionOptions}
        isPro={isPro}
        disabled={isPending}
        urlRequired={required.url}
        fileField={
          required.file && (
            <div className="flex flex-col gap-2">
              {/* The input is visually hidden and the drop target is a button,
                  so neither is a `<label for>` target — it names itself. */}
              <Label>{fileLabel}</Label>
              <FileUpload
                // Remounts on a type change, so the previous type's picker state
                // does not carry over with its limits and accepted extensions.
                key={selected.slug}
                slug={selected.slug}
                value={file}
                onChange={setFile}
                disabled={isPending}
                ariaLabel={fileLabel}
              />
              <ItemFieldError messages={fieldErrors.fileUrl} />
            </div>
          )
        }
      />
    </FormDialogBody>
  );
}
