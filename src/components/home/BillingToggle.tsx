'use client';

import { useState } from 'react';
import { PlanCard } from '@/components/home/PlanCard';
import { FREE_PLAN, PRO_BILLING, PRO_PLAN } from '@/components/home/content';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * The billing period switch and the two plans it governs.
 *
 * The plans are rendered from here rather than beside it because the switch
 * and the Pro price are one piece of state in two places on the page — and a
 * context provider wrapping the section, so the two could sit apart, would be
 * three client components where this is one. `PlanCard` stays a plain
 * presentational component, so the copy still lives in a data module.
 */
export function BillingToggle() {
  const [yearly, setYearly] = useState(false);
  const billing = yearly ? PRO_BILLING.yearly : PRO_BILLING.monthly;

  return (
    <>
      <div className="mb-9 flex flex-wrap items-center justify-center gap-3">
        <span className={cn('transition-colors', yearly ? 'text-muted-foreground' : 'text-foreground')}>
          Monthly
        </span>
        <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Bill yearly" />
        <span className={cn('transition-colors', yearly ? 'text-foreground' : 'text-muted-foreground')}>
          Yearly
        </span>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-500">
          Save 25%
        </span>
      </div>

      <div className="mx-auto grid max-w-[880px] grid-cols-1 gap-5 sm:grid-cols-2">
        <PlanCard {...FREE_PLAN} />
        <PlanCard {...PRO_PLAN} {...billing} />
      </div>
    </>
  );
}
