'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createItem } from '@/actions/items';
import { CodeEditor } from '@/components/items/CodeEditor';
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
import {
  editableFieldsFor,
  initialTypeId,
  parseTagInput,
  requiredFieldsFor,
  usesCodeEditor,
} from '@/lib/items';
import { isProType } from '@/lib/pro';
import { cn } from '@/lib/utils';
import type { CreateItemInput } from '@/lib/validation/items';
import type { SidebarItemType } from '@/types/item';

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

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return <p className="text-sm text-destructive">{messages.join('. ')}</p>;
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

  // The Pro types are File and Image, which need uploads that do not exist
  // yet — so they are browsable in the sidebar but not offered here.
  const types = itemTypes.filter((type) => !isProType(type.slug));

  function handleCreated() {
    setOpen(false);
    // Catches up the server-rendered lists behind the dialog — the stat tiles,
    // Pinned and Recent, and the items grid.
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10" disabled={types.length === 0}>
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
          types={types}
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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  // Falls back to the first type only to keep the slug a string; the selected
  // id always names one of these, since it can only come from the list.
  const selected = types.find((type) => type.id === typeId) ?? types[0];
  const fields = editableFieldsFor(selected.slug);
  const required = requiredFieldsFor(selected.slug);
  const codeContent = usesCodeEditor(selected.slug);

  // A guard for the button only — the action re-checks both, and trims before
  // it measures just as this does.
  const canSave = title.trim().length > 0 && (!required.url || url.trim().length > 0);

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
          <Select value={typeId} onValueChange={setTypeId}>
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
          <FieldError messages={fieldErrors.typeId} />
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
          <FieldError messages={fieldErrors.title} />
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
          <FieldError messages={fieldErrors.description} />
        </div>

        {fields.content && (
          <div className="flex flex-col gap-2">
            {/* Monaco has no element to point a <label for> at, so the code
                branch names itself through `ariaLabel` instead. */}
            {codeContent ? (
              <Label>Content</Label>
            ) : (
              <Label htmlFor="new-item-content">Content</Label>
            )}

            {codeContent ? (
              <CodeEditor
                value={content}
                onChange={setContent}
                language={language}
                minHeight={140}
                ariaLabel="Content"
                aria-invalid={Boolean(fieldErrors.content)}
              />
            ) : (
              <Textarea
                id="new-item-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                aria-invalid={Boolean(fieldErrors.content)}
                className="min-h-32 font-mono text-xs leading-relaxed"
              />
            )}
            <FieldError messages={fieldErrors.content} />
          </div>
        )}

        {fields.language && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-item-language">Language</Label>
            <Input
              id="new-item-language"
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
            <Label htmlFor="new-item-url">URL</Label>
            <Input
              id="new-item-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-invalid={Boolean(fieldErrors.url)}
              placeholder="https://example.com"
              required={required.url}
            />
            <FieldError messages={fieldErrors.url} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-item-tags">Tags</Label>
          <Input
            id="new-item-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            aria-invalid={Boolean(fieldErrors.tags)}
            placeholder="react, hooks, typescript"
          />
          <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
          <FieldError messages={fieldErrors.tags} />
        </div>
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
