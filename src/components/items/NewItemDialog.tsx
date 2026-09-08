'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createItem } from '@/actions/items';
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
  DialogTrigger,
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
import { editableFieldsFor, initialTypeId, parseTagInput, requiredFieldsFor } from '@/lib/items';
import { isImageUploadType } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import type { CreateItemInput } from '@/lib/validation/items';
import type { SidebarItemType } from '@/types/item';
import type { UploadedFile } from '@/types/upload';

interface NewItemDialogProps {
  /** Every type the user can see, Pro ones included — filtered here. */
  itemTypes: SidebarItemType[];
  /**
   * Which type the form opens on. Falls back to the first offered type when
   * absent or when the slug names a type that cannot be created — so a caller
   * cannot leave the selector on nothing.
   */
  defaultTypeSlug?: string;
  /** The trigger's text, for a caller that creates one specific type. */
  triggerLabel?: string;
}


/**
 * "New Item" in the top bar, and the dialog behind it.
 *
 * Also used by the items page, which passes the type it is showing so the form
 * opens on it — one dialog rather than a second, near-identical one.
 *
 * The form lives in a child so it unmounts with the dialog: a half-typed item
 * and its errors belong to the attempt that was abandoned, not to the next one.
 * That is also what re-applies `defaultTypeSlug` on every open, rather than
 * leaving the selector wherever the last abandoned attempt left it.
 */
export function NewItemDialog({
  itemTypes,
  defaultTypeSlug,
  triggerLabel = 'New Item',
}: NewItemDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Every type is offered. File and Image were held back only because uploads
  // did not exist; `isProType` still marks them in the sidebar, and enforcing
  // that marking is a job for billing, which does not exist either.

  function handleCreated() {
    setOpen(false);
    // Catches up the server-rendered lists behind the dialog — the stat tiles,
    // Pinned and Recent, and the items grid.
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10" disabled={itemTypes.length === 0}>
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

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
          defaultTypeSlug={defaultTypeSlug}
          onCreated={handleCreated}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface NewItemFormProps {
  /** Never empty: the trigger is disabled when there is nothing to pick. */
  types: SidebarItemType[];
  defaultTypeSlug?: string;
  onCreated: () => void;
  onCancel: () => void;
}

function NewItemForm({ types, defaultTypeSlug, onCreated, onCancel }: NewItemFormProps) {
  const [typeId, setTypeId] = useState(() => initialTypeId(types, defaultTypeSlug));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<UploadedFile | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

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

    const payload: CreateItemInput = {
      typeId,
      title,
      description,
      tags: parseTagInput(tags),
    };

    // Only what this type shows. A field the form never rendered is left off
    // entirely rather than sent blank.
    if (fields.content) payload.content = content;
    if (fields.language) payload.language = language;
    if (fields.url) payload.url = url;

    if (required.file && file) {
      // `fileUrl` holds the object's key, not a URL — uploads are private and
      // are read back through `/api/files/[id]`.
      payload.fileUrl = file.key;
      payload.fileName = file.fileName;
      payload.fileSize = file.fileSize;
    }

    startTransition(async () => {
      const result = await createItem(payload);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);

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

                return (
                  <SelectItem key={type.id} value={type.id}>
                    <Icon className={cn('size-4', textColorClass(type.color))} />
                    {capitalize(type.name)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <ItemFieldError messages={fieldErrors.typeId} />
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
