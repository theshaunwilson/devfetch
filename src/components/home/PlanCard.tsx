import Link from 'next/link';
import { REGISTER_PATH, type PlanCopy } from '@/components/home/content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PlanCardProps = PlanCopy;

/**
 * One pricing plan. Both plans render through this — the Pro card differs only
 * in its ring, its flag and the emphasis on its feature list.
 *
 * The flag sits inside the card rather than straddling its top edge: `Card`
 * clips its overflow, so an overhanging badge would be cut in half.
 */
export function PlanCard({
  name,
  pitch,
  amount,
  period,
  note,
  features,
  cta,
  featured,
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        'h-full gap-0 px-7 py-7.5',
        featured && 'ring-2 ring-blue-500/40 max-sm:order-first'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{name}</h3>
        {featured && <Badge>Most popular</Badge>}
      </div>
      <p className="mt-1.5 text-muted-foreground">{pitch}</p>

      <p className="mt-5.5 flex items-baseline gap-2.5">
        <span className="font-display text-[2.75rem] leading-none font-semibold tracking-[-0.04em]">
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

      <Button asChild variant={featured ? 'default' : 'outline'} className="mt-auto h-11 w-full">
        <Link href={REGISTER_PATH}>{cta}</Link>
      </Button>
    </Card>
  );
}
