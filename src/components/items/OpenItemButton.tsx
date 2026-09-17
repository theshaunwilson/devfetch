'use client';

import { useItemDrawer } from '@/components/items/ItemDrawerProvider';
import { cn } from '@/lib/utils';
import type { DashboardItem } from '@/types/item';

/**
 * Makes a whole item card open the detail drawer.
 *
 * An overlay button rather than wrapping the card in one: a `<button>` takes
 * phrasing content only, and a card holds a heading and paragraphs. This keeps
 * native button semantics — click, Enter and Space — without invalid markup.
 */
export function OpenItemButton({ item, className }: { item: DashboardItem; className?: string }) {
  const { openItem } = useItemDrawer();

  return (
    <button
      type="button"
      onClick={(event) => openItem(item, event.currentTarget)}
      // The card clips overflow, so an outset focus ring would be cut off. The
      // radius matches a card; a caller that is not one overrides it.
      className={cn(
        'absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none',
        className
      )}
    >
      <span className="sr-only">Open {item.title}</span>
    </button>
  );
}
