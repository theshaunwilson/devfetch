'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CopyableField } from '@/lib/items';
import type { ItemDetailResponse } from '@/types/item';

/** How long the button stays confirmed before going back to its icon. */
const COPIED_FEEDBACK_MS = 2000;

/**
 * The item's body, fetched on click rather than carried by the card.
 *
 * A card deliberately does not hold `content`: it is capped at 100,000
 * characters and the items pages are unpaginated, so selecting it into
 * `ITEM_SELECT` would put every item's whole body into every list payload for
 * the sake of a button most of them will never have pressed. This is the same
 * "fetch on click" the drawer itself does.
 */
async function fetchCopyText(itemId: string, field: CopyableField): Promise<string> {
  const response = await fetch(`/api/items/${itemId}`);
  const result: ItemDetailResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error);
  }

  const value = result.data[field];

  // Both fields are nullable, so a type that can hold a body is not a
  // guarantee that this item has one.
  if (!value) {
    throw new Error('That item has nothing to copy.');
  }

  return value;
}

/**
 * Puts the text on the clipboard, given the request that is still in flight.
 *
 * Safari drops clipboard permission across an `await`, so the pending promise
 * is handed to `ClipboardItem` and resolved inside the gesture instead. Where
 * that is unsupported — Firefox has `ClipboardItem` but wants a Blob, not a
 * promise — it falls back to `writeText` on the same, already-started promise,
 * so nothing is ever fetched twice.
 */
async function writeToClipboard(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': text.then((value) => new Blob([value], { type: 'text/plain' })),
        }),
      ]);

      return;
    } catch {
      // Falls through. If it was the fetch that failed, the await below
      // rejects again with the real reason rather than a clipboard error.
    }
  }

  await navigator.clipboard.writeText(await text);
}

interface CopyItemButtonProps {
  itemId: string;
  /** Which field holds this item's body — see `copyableFieldFor`. */
  field: CopyableField;
  /** Named in the label, so a screen reader hears which item is being copied. */
  title: string;
  className?: string;
}

/**
 * Copies an item's body straight from its card, without opening the drawer.
 *
 * Its own component rather than the editors' `CopyButton`: that one is handed
 * the live buffer it sits above, which is a string it already has. This one has
 * to go and get the item first, which is a different enough contract to keep
 * the two apart.
 */
export function CopyItemButton({ itemId, field, title, className }: CopyItemButtonProps) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    setPending(true);

    try {
      await writeToClipboard(fetchCopyText(itemId, field));
      setCopied(true);
    } catch (error) {
      // Louder than the editors' copy buttons, which simply do not confirm:
      // those failed on the clipboard alone, while this one may have failed
      // because the item is gone, and that is worth saying.
      toast.error(error instanceof Error ? error.message : 'Could not copy that item.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      disabled={pending}
      // The state is announced here rather than by swapping a visible label,
      // so a screen reader hears the confirmation the icon shows.
      aria-label={copied ? 'Copied' : `Copy ${title}`}
      className={cn(
        // z-20 rather than a click handler that stops propagation: the card's
        // trigger is an `absolute inset-0` overlay at z-10, not a wrapper, so
        // there is no click to stop — the button simply has to sit above it.
        // 36px below `sm`, 28 above. The painted icon does not change; the
        // target does. Measured at 375px these sat 2px apart over a full-row
        // open button, which is a mis-tap waiting to happen — a pointer target
        // has to clear 24x24, and two of them this close want more.
        'relative z-20 size-9 shrink-0 text-muted-foreground hover:text-foreground sm:size-7',
        className
      )}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
