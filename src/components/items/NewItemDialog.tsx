'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createItem } from '@/actions/items';
import { CollectionSelect } from '@/components/items/CollectionSelect';
import { FileUpload } from '@/components/items/FileUpload';
import { ItemContentField } from '@/components/items/ItemContentField';
import { ItemFieldError } from '@/components/items/ItemFieldError';
import { ItemTextField } from '@/components/items/ItemTextField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { textColorClass } from '@/lib/colors';
import { capitalize } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import {
  buildCreateItemPayload,
  editableFieldsFor,
  initialTypeId,
  requiredFieldsFor,
} from '@/lib/items';
import { useUpgradeToast } from '@/hooks/use-upgrade-toast';
import { canCreateType } from '@/lib/pro';
import { isImageUploadType } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import type { CollectionOption } from '@/types/collection';
import type { SidebarItemType } from '@/types/item';
import type { UploadedFile } from '@/types/upload';

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
 * Controlled from outside rather than carrying its own trigger, the way
 * `EditCollectionDialog` is: the top bar opens it from a `DropdownMenuItem`,
 * which unmounts when the menu closes — so a dialog nested in one would be
 * torn down on the very click that opened it. Each call site renders its own
 * trigger and flips this open, which is also what lets the top bar's `+` menu
 * and the items page's labelled button share one dialog.
 *
 * The form lives in a child so it unmounts with the dialog: a half-typed item
 * and its errors belong to the attempt that was abandoned, not to the next one.
 * That is also what re-applies `defaultTypeSlug` on every open, rather than
 * leaving the selector wherever the last abandoned attempt left it.
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Capped and column-laid-out rather than left to `DialogContent`'s own
          `grid`: the snippet form is taller than a short laptop viewport, and
          the dialog is `fixed` inside an `overflow-hidden` shell, so without
          this the submit button ends up below the fold with nothing to scroll.
          `svh` rather than `vh` for the mobile browser chrome. */}
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Pick a type — the fields below follow from it.</DialogDescription>
        </DialogHeader>

        <NewItemForm
          types={itemTypes}
          isPro={isPro}
          collectionOptions={collectionOptions}
          defaultTypeSlug={defaultTypeSlug}
          onCreated={onCreated}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [file, setFile] = useState<UploadedFile | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const upgradeToast = useUpgradeToast();

  // Falls back to the first type only to keep the slug a string; the selected
  // id always names one of these, since it can only come from the list.
  const selected = types.find((type) => type.id === typeId) ?? types[0];
  const fields = editableFieldsFor(selected.slug);
  const required = requiredFieldsFor(selected.slug);

  // A guard for the button only — the action re-checks both, and trims before
  // it measures just as this does.
  const canSave =
    title.trim().length > 0 &&
    (!required.url || url.trim().length > 0) &&
    (!required.file || file !== null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildCreateItemPayload({
      typeId,
      slug: selected.slug,
      title,
      description,
      content,
      language,
      url,
      tags,
      collectionIds,
      file,
    });

    startTransition(async () => {
      const result = await createItem(payload);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        // A Pro wall reads as its own alert, not as a failure: red, top
        // centre, and offering the upgrade. The server decides which refusals
        // those are — see `upgradeRequired` on `CreateItemResult`.
        if (result.upgradeRequired) {
          upgradeToast(result.error);
        } else {
          toast.error(result.error);
        }

        return;
      }

      toast.success('Item created');
      onCreated();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Only the fields scroll, so the footer's buttons stay put however tall
          the form for the selected type is. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-item-title">Title</Label>
          <Input
            id="new-item-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
            autoFocus
            required
          />
          <ItemFieldError messages={fieldErrors.title} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-item-description">Description</Label>
          <Textarea
            id="new-item-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
            rows={2}
          />
          <ItemFieldError messages={fieldErrors.description} />
        </div>

        {fields.content && (
          <ItemContentField
            idPrefix="new-item"
            slug={selected.slug}
            value={content}
            onChange={setContent}
            language={language}
            codeMinHeight={140}
            markdownMinHeight={220}
            textareaClassName="min-h-32 font-mono text-xs leading-relaxed"
            messages={fieldErrors.content}
          />
        )}

        {fields.language && (
          <ItemTextField
            id="new-item-language"
            label="Language"
            value={language}
            onChange={setLanguage}
            placeholder="typescript"
            messages={fieldErrors.language}
          />
        )}

        {fields.url && (
          <ItemTextField
            id="new-item-url"
            label="URL"
            type="url"
            value={url}
            onChange={setUrl}
            placeholder="https://example.com"
            required={required.url}
            messages={fieldErrors.url}
          />
        )}

        {required.file && (
          <div className="flex flex-col gap-2">
            {/* The input is visually hidden and the drop target is a button,
                so neither is a `<label for>` target — it names itself. */}
            <Label>{isImageUploadType(selected.slug) ? 'Image' : 'File'}</Label>
            <FileUpload
              // Remounts on a type change, so the previous type's picker state
              // does not carry over with its limits and accepted extensions.
              key={selected.slug}
              slug={selected.slug}
              value={file}
              onChange={setFile}
              disabled={isPending}
              ariaLabel={isImageUploadType(selected.slug) ? 'Image' : 'File'}
            />
            <ItemFieldError messages={fieldErrors.fileUrl} />
          </div>
        )}

        <ItemTextField
          id="new-item-tags"
          label="Tags"
          value={tags}
          onChange={setTags}
          placeholder="react, hooks, typescript"
          hint="Separate tags with commas."
          messages={fieldErrors.tags}
        />

        <CollectionSelect
          id="new-item-collections"
          options={collectionOptions}
          value={collectionIds}
          onChange={setCollectionIds}
          disabled={isPending}
          messages={fieldErrors.collectionIds}
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
          {isPending ? 'Creating…' : 'Create item'}
        </Button>
      </DialogFooter>
    </form>
  );
}
