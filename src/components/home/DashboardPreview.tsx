import { WindowDots } from '@/components/items/EditorChrome';
import { Keycap, PREVIEW_ITEMS, PREVIEW_NAV } from '@/components/home/content';
import { borderColorClass, textColorClass } from '@/lib/colors';
import { cn } from '@/lib/utils';

/**
 * The "…with DevFetch" panel: a still of the real dashboard, drawn rather than
 * screenshotted so it stays legible at a third of the size.
 *
 * Every dot and card accent is a real item-type colour resolved through
 * `lib/colors.ts`, which is what makes the preview and the product agree.
 */
export function DashboardPreview() {
  return (
    <div className="flex h-65 flex-col overflow-hidden rounded-xl border border-border bg-card lg:h-75">
      <div className="flex h-11 flex-none items-center gap-3.5 border-b border-border bg-muted/40 px-3.5">
        <WindowDots />
        <span className="flex h-6.5 min-w-0 flex-1 items-center justify-between overflow-hidden rounded-md border border-border bg-background px-2 text-xs whitespace-nowrap text-muted-foreground">
          Search everything
          <Keycap>⌘K</Keycap>
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[104px_1fr] lg:grid-cols-[116px_1fr]">
        <div className="flex flex-col gap-0.5 border-r border-border p-2 py-3">
          {PREVIEW_NAV.map((row, index) => (
            <span
              key={row.label}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-xs',
                index === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'size-1.75 flex-none rounded-full',
                  row.accent ? `${textColorClass(row.accent)} bg-current` : 'bg-foreground'
                )}
              />
              {row.label}
            </span>
          ))}
        </div>

        <div className="grid auto-rows-auto grid-cols-1 gap-2.5 overflow-hidden p-3 lg:auto-rows-fr lg:grid-cols-2">
          {PREVIEW_ITEMS.map((item) => (
            <span
              key={item.title}
              className={cn(
                'flex min-w-0 flex-col justify-center gap-0.5 rounded-lg border border-l-2 border-border bg-muted px-2.5 py-2',
                // The real ItemCard carries its accent on the left edge, and
                // `borderColorClass` returns exactly that class — so the
                // preview shows the border the product actually draws rather
                // than the prototype's top edge.
                borderColorClass(item.accent)
              )}
            >
              <span className="truncate text-xs text-foreground">{item.title}</span>
              <span className="truncate font-code text-[0.6875rem] text-muted-foreground">
                {item.meta}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
