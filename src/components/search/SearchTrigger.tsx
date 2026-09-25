'use client';

import { Search } from 'lucide-react';
import { useSyncExternalStore, type Ref } from 'react';

import { cn } from '@/lib/utils';

/** Nothing to subscribe to: the platform does not change under a mounted page. */
function subscribeToNothing(): () => void {
  return () => {};
}

interface SearchTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onOpen: () => void;
}

/**
 * The top bar's way into the palette: an icon button on a narrow screen, the
 * labelled field from `lg` up.
 *
 * One element rather than two, because the ref has to name whichever is on
 * screen — focus returns here when the palette or the drawer closes, and a ref
 * split across a hidden twin would return it to a `display: none` element.
 *
 * `lg` is where the field is wide enough, and that threshold is inherited
 * rather than guessed: what binds is the header's width, which is the viewport
 * less the open sidebar's 256px, so the label had already been cut twice at
 * `md` before the field was dropped for an icon.
 */
export function SearchTrigger({ ref, onOpen }: SearchTriggerProps) {
  // The server cannot know the platform, so the hint renders as ⌘ and is
  // corrected on the client. `useSyncExternalStore` rather than state set from
  // an effect, which is what it exists for — and what keeps hydration honest.
  const isMac = useSyncExternalStore(
    subscribeToNothing,
    () => /mac/i.test(navigator.userAgent),
    () => true,
  );

  return (
    <div className="relative shrink-0 lg:min-w-0 lg:flex-1 lg:shrink lg:basis-0 lg:max-w-lg">
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none',
          'hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
          // From `lg` it stops being a button-shaped icon and becomes the
          // field: full width, bordered, left-aligned, with room at the
          // right for the shortcut hint sitting over it.
          'lg:w-full lg:justify-start lg:gap-2 lg:border lg:border-input lg:bg-transparent lg:py-1 lg:pr-16 lg:pl-2.5 lg:text-left lg:text-sm',
          'lg:hover:border-ring/50 lg:hover:bg-transparent lg:hover:text-muted-foreground lg:focus-visible:border-ring',
          'lg:dark:bg-input/30'
        )}
      >
        <Search className="size-4 shrink-0" />
        <span className="sr-only lg:not-sr-only lg:truncate">Search items...</span>
      </button>

      {/* Only where the field it sits inside exists. */}
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">
        {isMac ? '⌘ K' : 'Ctrl K'}
      </kbd>
    </div>
  );
}
