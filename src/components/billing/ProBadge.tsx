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
 * solid badge would be the only one of its kind in the UI. The colour is the
 * `--pro` token, which clears AA as text on its own tint in both themes.
 *
 * `border-transparent` overrides the `outline` variant's default border so the
 * ring below actually shows; `variant="outline"` is still what gives it
 * the same height and padding as the Email/GitHub badge it sits beside.
 */
export function ProBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent bg-pro/15 text-pro ring-1 ring-pro/30',
        className,
      )}
    >
      Pro
    </Badge>
  );
}
