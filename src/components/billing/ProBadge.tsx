import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Marks the signed-in account as being on Pro.
 *
 * Deliberately **not** the same badge as `SidebarContent`'s type marker, which
 * is a muted outline chip meaning "this item type is gated". That one is a
 * warning aimed at free accounts; this is a status aimed at paying ones, and
 * the two would be read as the same thing if they looked alike.
 *
 * Tinted rather than filled: every accent in this app is drawn as a soft
 * background with brighter text (`softBgColorClass` + `textColorClass`), so a
 * solid badge would be the only one of its kind in the UI. `emerald-400`
 * rather than `-500` for the text is the tier `brightTextColorClass` added
 * when the homepage review measured `-500` against these tints at 4.47:1,
 * under AA — the same reasoning, applied by hand here because the colour is
 * fixed rather than derived from an item type's hex.
 *
 * `border-transparent` overrides the `outline` variant's default border so the
 * emerald one below actually shows; `variant="outline"` is still what gives it
 * the same height and padding as the Email/GitHub badge it sits beside.
 */
export function ProBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
        className,
      )}
    >
      Pro
    </Badge>
  );
}
