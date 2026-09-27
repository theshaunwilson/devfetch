'use client';

import { CollectionSelect } from '@/components/items/CollectionSelect';
import { ItemContentField } from '@/components/items/ItemContentField';
import { ItemDescriptionField } from '@/components/items/ItemDescriptionField';
import { ItemFieldError } from '@/components/items/ItemFieldError';
import { ItemTagsField } from '@/components/items/ItemTagsField';
import { ItemTextField } from '@/components/items/ItemTextField';
import { LanguageSelect } from '@/components/items/LanguageSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildSummarySource, editableFieldsFor } from '@/lib/items';
import type { CollectionOption } from '@/types/collection';

/** What an item form holds while it is being filled in. */
export interface ItemFormValues {
  title: string;
  description: string;
  content: string;
  language: string;
  url: string;
  tags: string;
  collectionIds: string[];
}

/**
 * Field sizes per surface. The create dialog is capped to the viewport, so its
 * fields start shorter than the drawer's, which has the full height to use.
 */
const SIZES = {
  dialog: {
    descriptionRows: 2,
    codeMinHeight: 140,
    markdownMinHeight: 220,
    textareaClassName: 'min-h-32 font-mono text-xs leading-relaxed',
  },
  drawer: {
    descriptionRows: 3,
    codeMinHeight: 160,
    markdownMinHeight: 240,
    textareaClassName: 'min-h-40 font-mono text-xs leading-relaxed',
  },
} as const;

interface ItemFormFieldsProps {
  /** Prefixes every field id — `new-item` in the dialog, `item` in the drawer. */
  idPrefix: string;
  size: keyof typeof SIZES;
  /** The item's type, which decides the type-specific fields. */
  slug: string;
  typeName: string;
  /** The uploaded file's name, which a description can be written from. */
  fileName: string | null;
  values: ItemFormValues;
  onChange: (patch: Partial<ItemFormValues>) => void;
  fieldErrors: Record<string, string[]>;
  collectionOptions: CollectionOption[];
  /** Whether the AI description and tag buttons are offered. */
  isPro: boolean;
  /** While a save is in flight. */
  disabled: boolean;
  urlRequired?: boolean;
  /** Rendered after the URL field, for the create dialog's file upload. */
  fileField?: React.ReactNode;
}

/**
 * The fields an item is created and edited through, in the order both forms
 * show them.
 *
 * Renders only: each form owns its state and its submit, since create and edit
 * send different payloads to different actions. A fragment, so each form keeps
 * its own container and spacing.
 */
export function ItemFormFields({
  idPrefix,
  size,
  slug,
  typeName,
  fileName,
  values,
  onChange,
  fieldErrors,
  collectionOptions,
  isPro,
  disabled,
  urlRequired,
  fileField,
}: ItemFormFieldsProps) {
  const fields = editableFieldsFor(slug);
  const sizes = SIZES[size];
  const { title, description, content, language, url, tags, collectionIds } = values;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-invalid={Boolean(fieldErrors.title)}
          autoFocus
          required
        />
        <ItemFieldError messages={fieldErrors.title} />
      </div>

      <ItemDescriptionField
        id={`${idPrefix}-description`}
        value={description}
        onChange={(next) => onChange({ description: next })}
        rows={sizes.descriptionRows}
        messages={fieldErrors.description}
        summarizeFrom={
          isPro
            ? buildSummarySource({ slug, typeName, title, content, language, url, tags, fileName })
            : undefined
        }
      />

      {fields.language && (
        <LanguageSelect
          id={`${idPrefix}-language`}
          value={language}
          onChange={(next) => onChange({ language: next })}
          disabled={disabled}
          messages={fieldErrors.language}
        />
      )}

      {fields.content && (
        <ItemContentField
          idPrefix={idPrefix}
          slug={slug}
          value={content}
          onChange={(next) => onChange({ content: next })}
          language={language}
          codeMinHeight={sizes.codeMinHeight}
          markdownMinHeight={sizes.markdownMinHeight}
          textareaClassName={sizes.textareaClassName}
          messages={fieldErrors.content}
        />
      )}

      {fields.url && (
        <ItemTextField
          id={`${idPrefix}-url`}
          label="URL"
          type="url"
          value={url}
          onChange={(next) => onChange({ url: next })}
          placeholder="https://example.com"
          required={urlRequired}
          messages={fieldErrors.url}
        />
      )}

      {fileField}

      <ItemTagsField
        id={`${idPrefix}-tags`}
        value={tags}
        onChange={(next) => onChange({ tags: next })}
        messages={fieldErrors.tags}
        // Only the fields this type shows: the others may still hold text from
        // a type picked earlier, which the save would not send.
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
        id={`${idPrefix}-collections`}
        options={collectionOptions}
        value={collectionIds}
        onChange={(next) => onChange({ collectionIds: next })}
        disabled={disabled}
        messages={fieldErrors.collectionIds}
      />
    </>
  );
}
