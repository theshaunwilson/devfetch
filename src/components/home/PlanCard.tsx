import Link from 'next/link';
import { type PlanCopy } from '@/components/home/content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PlanCta } from '@/lib/plan-cta';
import { cn } from '@/lib/utils';

interface PlanCardProps extends PlanCopy {
  /**
   * What the button does, already resolved for this viewer by `planCta`. The
   * card stays presentational: it renders the decision, it does not make it.
   */
  action: PlanCta;
  /** Runs when `action` is a checkout. Ignored for a link. */
  onCheckout: () => void;
  /** Disables the button while a checkout is in flight. */
  pending: boolean;
}

/**
 * One pricing plan. Both plans render through this — the Pro card differs only
 * in its ring, its flag and the emphasis on its feature list.
 *
 * The flag sits inside the card rather than straddling its top edge: `Card`
 * clips its overflow, so an overhanging badge would be cut in half.
 *
 * The featured card is deliberately NOT reordered ahead of Free on narrow
 * screens. `order` moves a box visually without moving it in the DOM, so a
 * keyboard user would reach Free first while seeing Pro first, and flipping
 * the DOM instead only moves that mismatch to the side-by-side layout. The
 * ring and the flag carry the emphasis instead, at every width.
 */
export function PlanCard({
  name,
  pitch,
  amount,
  period,
  note,
  features,
  featured,
  action,
  onCheckout,
  pending,
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        'h-full gap-0 px-7 py-7.5',
        featured && 'ring-2 ring-blue-500/40'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-xl font-semibold tracking-[-0.02em]">{name}</h3>
        {featured && <Badge>Most popular</Badge>}
      </div>
      <p className="mt-1.5 text-muted-foreground">{pitch}</p>

      <p className="mt-5.5 flex items-baseline gap-2.5">
        <span className="font-heading text-[2.75rem] leading-none font-semibold tracking-[-0.04em]">
          {amount}
        </span>
        <span className="text-muted-foreground">{period}</span>
      </p>
      <p className="mt-2 min-h-6 text-[0.8125rem] text-muted-foreground">{note}</p>

      <ul className="my-6 flex flex-col gap-2.75">
        {features.map((feature) => (
          <li
            key={feature}
            className={cn(
              'relative pl-6.5',
              featured ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'absolute top-2.5 left-1 size-2 rounded-full',
                featured ? 'bg-blue-500' : 'bg-border'
              )}
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>

      {/* A link and a button are different elements, not one element with a
          conditional handler: `asChild` makes this render *as* its child, so
          the two cannot be merged without producing an anchor that also fires
          an action. */}
      {action.kind === 'link' ? (
        <Button asChild variant={featured ? 'default' : 'outline'} className="mt-auto h-11 w-full">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : (
        <Button
          variant={featured ? 'default' : 'outline'}
          className="mt-auto h-11 w-full"
          disabled={pending}
          onClick={onCheckout}
        >
          {pending ? 'Starting…' : action.label}
        </Button>
      )}
    </Card>
  );
}
