'use client';

import { useState } from 'react';
import { PlanCard } from '@/components/home/PlanCard';
import { FREE_PLAN, PRO_BILLING, PRO_PLAN } from '@/components/home/content';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface PeriodLabelProps {
  children: string;
  active: boolean;
  onSelect: () => void;
}

/**
 * One of the two period words beside the switch.
 *
 * These were `<span>`s, which put the state's name next to the control without
 * making it operable — people aim at the word rather than the switch, and
 * nothing happened. `aria-pressed` carries the state rather than the label
 * flipping, so the name stays stable between presses, the treatment
 * `FavoriteItemButton` uses.
 */
function PeriodLabel({ children, active, onSelect }: PeriodLabelProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'min-h-6 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

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
      <div className="mb-9 flex flex-wrap items-center justify-center gap-4">
        <PeriodLabel active={!yearly} onSelect={() => setYearly(false)}>
          Monthly
        </PeriodLabel>
        {/*
          The painted switch is 32x18, under the 24x24 minimum a pointer target
          has to meet. Rather than resize the shared component — which would
          also resize the ones on /settings — an empty `::after` extends only
          the hit area, to 52x38. The 16px gap either side keeps it clear of
          the two labels, which are now targets of their own.
        */}
        <Switch
          checked={yearly}
          onCheckedChange={setYearly}
          aria-label="Bill yearly"
          className="relative after:absolute after:-inset-2.5 after:content-['']"
        />
        <PeriodLabel active={yearly} onSelect={() => setYearly(true)}>
          Yearly
        </PeriodLabel>
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
