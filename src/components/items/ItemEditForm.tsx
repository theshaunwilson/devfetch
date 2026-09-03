'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { updateItem } from '@/actions/items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetHeader } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { editableFieldsFor, formatTagInput, parseTagInput } from '@/lib/items';
import type { UpdateItemInput } from '@/lib/validation/items';
import type { ItemDetail } from '@/types/item';

interface ItemEditFormProps {
  item: ItemDetail;
  /** The drawer's identity block, so both modes show the same one. */
  heading: React.ReactNode;
  /** Handed the saved item, in full. */
  onSaved: (item: ItemDetail) => void;
  onCancel: () => void;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return <p className="text-sm text-destructive">{messages.join('. ')}</p>;
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
export function ItemEditForm({ item, heading, onSaved, onCancel }: ItemEditFormProps) {
  const fields = editableFieldsFor(item.type.slug);

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [content, setContent] = useState(item.content ?? '');
  const [language, setLanguage] = useState(item.language ?? '');
  const [url, setUrl] = useState(item.url ?? '');
  const [tags, setTags] = useState(formatTagInput(item.tags));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  // A basic guard only — the schema in the server action is what actually
  // decides, and it trims before it measures just like this does.
  const canSave = title.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: UpdateItemInput = { title, description, tags: parseTagInput(tags) };

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
          <FieldError messages={fieldErrors.title} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="item-description">Description</Label>
          <Textarea
            id="item-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
            rows={3}
          />
          <FieldError messages={fieldErrors.description} />
        </div>

        {fields.content && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-content">Content</Label>
            <Textarea
              id="item-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              aria-invalid={Boolean(fieldErrors.content)}
              className="min-h-40 font-mono text-xs leading-relaxed"
            />
            <FieldError messages={fieldErrors.content} />
          </div>
        )}

        {fields.language && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-language">Language</Label>
            <Input
              id="item-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-invalid={Boolean(fieldErrors.language)}
              placeholder="typescript"
            />
            <FieldError messages={fieldErrors.language} />
          </div>
        )}

        {fields.url && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-url">URL</Label>
            <Input
              id="item-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-invalid={Boolean(fieldErrors.url)}
              placeholder="https://example.com"
            />
            <FieldError messages={fieldErrors.url} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="item-tags">Tags</Label>
          <Input
            id="item-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            aria-invalid={Boolean(fieldErrors.tags)}
            placeholder="react, hooks, typescript"
          />
          <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
          <FieldError messages={fieldErrors.tags} />
        </div>
      </div>
    </form>
  );
}
