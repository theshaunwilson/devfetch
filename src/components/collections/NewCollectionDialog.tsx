'use client';

import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { createCollection } from '@/actions/collections';
import { ItemFieldError } from '@/components/items/ItemFieldError';
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
import { Textarea } from '@/components/ui/textarea';

/**
 * "New Collection" in the top bar, and the dialog behind it.
 *
 * The form lives in a child so it unmounts with the dialog: a half-typed
 * collection and its errors belong to the attempt that was abandoned, not to
 * the next one — the same reason `NewItemDialog` is built this way.
 */
export function NewCollectionDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleCreated() {
    setOpen(false);
    // Catches up everything the new collection lands in. `AppShell` and
    // `/dashboard` are both `force-dynamic`, so one refresh re-renders the
    // layout as well as the page: the sidebar's Favorites and Recent lists,
    // the Collections grid and both collection stat tiles.
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* Hidden below `md` as this button has always been — the top bar has
            no room for it beside search and New Item on a phone. */}
        <Button variant="outline" className="hidden h-10 md:inline-flex">
          <FolderPlus className="size-4" />
          New Collection
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>Group related items under one name.</DialogDescription>
        </DialogHeader>

        <NewCollectionForm onCreated={handleCreated} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
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

  // A guard for the button only — the action re-checks, and trims before it
  // measures just as this does.
  const canSave = name.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createCollection({ name, description });

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);

        return;
      }

      toast.success('Collection created');
      onCreated();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Only the fields scroll, so the footer's buttons stay put — the same
          shape as the item dialog, which needs it on a short viewport. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-collection-name">Name</Label>
          <Input
            id="new-collection-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            placeholder="React Patterns"
            autoFocus
            required
          />
          <ItemFieldError messages={fieldErrors.name} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-collection-description">Description</Label>
          <Textarea
            id="new-collection-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
            rows={3}
          />
          <ItemFieldError messages={fieldErrors.description} />
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
          {isPending ? 'Creating…' : 'Create collection'}
        </Button>
      </DialogFooter>
    </form>
  );
}
