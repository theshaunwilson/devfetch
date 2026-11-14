import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Marks the signed-in account as being on the free plan.
 *
 * The counterpart to `ProBadge`, and deliberately the quieter of the two: it
 * states a fact rather than celebrating one, so it is drawn in the muted
 * tokens the rest of the app uses for secondary text. Pro keeps the `--pro`
 * tint, which is what makes the two distinguishable at a glance.
 *
 * `variant="outline"` gives it the same height and padding as `ProBadge`, so
 * the `Current plan` line does not shift as the plan changes.
 */
export function FreeBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-muted-foreground', className)}>
      Free
    </Badge>
  );
}
