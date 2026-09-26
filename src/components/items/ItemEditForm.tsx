'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { updateItem } from '@/actions/items';
import { CollectionSelect } from '@/components/items/CollectionSelect';
import { ItemContentField } from '@/components/items/ItemContentField';
import { ItemDescriptionField } from '@/components/items/ItemDescriptionField';
import { ItemFieldError } from '@/components/items/ItemFieldError';
import { ItemTagsField } from '@/components/items/ItemTagsField';
import { ItemTextField } from '@/components/items/ItemTextField';
import { LanguageSelect } from '@/components/items/LanguageSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetHeader } from '@/components/ui/sheet';
import { buildSummarySource, editableFieldsFor, formatTagInput, parseTagInput } from '@/lib/items';
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

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [content, setContent] = useState(item.content ?? '');
  const [language, setLanguage] = useState(item.language ?? '');
  const [url, setUrl] = useState(item.url ?? '');
  const [tags, setTags] = useState(formatTagInput(item.tags));
  const [collectionIds, setCollectionIds] = useState(() =>
    item.collections.map((collection) => collection.id),
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  // A basic guard only — the schema in the server action is what actually
  // decides, and it trims before it measures just like this does.
  const canSave = title.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: UpdateItemInput = {
      title,
      description,
      tags: parseTagInput(tags),
      collectionIds,
    };

    // Only the fields this type actually shows. Sending the rest would clear
    // whatever a previous type-specific edit had put there.
    if (fields.content) payload.content = content;
    if (fields.language) payload.language = language;
    if (fields.url) payload.url = url;

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
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-title">Title</Label>
          <Input
            id="item-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
            autoFocus
            required
          />
          <ItemFieldError messages={fieldErrors.title} />
        </div>

        <ItemDescriptionField
          id="item-description"
          value={description}
          onChange={setDescription}
          rows={3}
          messages={fieldErrors.description}
          summarizeFrom={
            isPro
              ? buildSummarySource({
                  slug: item.type.slug,
                  typeName: item.type.name,
                  title,
                  content,
                  language,
                  url,
                  tags,
                  fileName: item.fileName,
                })
              : undefined
          }
        />

        {fields.language && (
          <LanguageSelect
            id="item-language"
            value={language}
            onChange={setLanguage}
            disabled={isPending}
            messages={fieldErrors.language}
          />
        )}

        {fields.content && (
          <ItemContentField
            idPrefix="item"
            slug={item.type.slug}
            value={content}
            onChange={setContent}
            language={language}
            codeMinHeight={160}
            markdownMinHeight={240}
            textareaClassName="min-h-40 font-mono text-xs leading-relaxed"
            messages={fieldErrors.content}
          />
        )}

        {fields.url && (
          <ItemTextField
            id="item-url"
            label="URL"
            type="url"
            value={url}
            onChange={setUrl}
            placeholder="https://example.com"
            messages={fieldErrors.url}
          />
        )}

        <ItemTagsField
          id="item-tags"
          value={tags}
          onChange={setTags}
          messages={fieldErrors.tags}
          // Only the fields this type shows, as with the save payload.
          suggestFrom={
            isPro
              ? {
                  title,
                  description,
                  content: fields.content ? content : undefined,
                  url: fields.url ? url : undefined,
                }
              : undefined
          }
        />

        <CollectionSelect
          id="item-collections"
          options={collectionOptions}
          value={collectionIds}
          onChange={setCollectionIds}
          disabled={isPending}
          messages={fieldErrors.collectionIds}
        />
      </div>
    </form>
  );
}
