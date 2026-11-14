'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { startCheckout } from '@/actions/billing';
import { PlanCard } from '@/components/home/PlanCard';
import { FREE_PLAN, PRO_BILLING, PRO_PLAN } from '@/components/home/content';
import { Switch } from '@/components/ui/switch';
import { planCta, type PlanViewer } from '@/lib/plan-cta';
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
        'min-h-6 max-sm:min-h-10 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors',
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
 *
 * It also already holds the monthly/yearly state, which is exactly the
 * `interval` a checkout needs — so the signed-in Pro CTA starts checkout from
 * here rather than needing a second piece of state anywhere else.
 */
export function BillingToggle({ isSignedIn, isPro }: PlanViewer) {
  const [yearly, setYearly] = useState(false);
  const [isPending, startTransition] = useTransition();
  const billing = yearly ? PRO_BILLING.yearly : PRO_BILLING.monthly;
  const viewer = { isSignedIn, isPro };

  function upgrade() {
    startTransition(async () => {
      // Returns only on failure — success redirects to Stripe's hosted
      // Checkout, which throws `NEXT_REDIRECT` and never comes back.
      const result = await startCheckout(yearly ? 'yearly' : 'monthly');

      toast.error(result.error);
    });
  }

  return (
    <>
      <div className="mb-9 flex flex-wrap items-center justify-center gap-4">
        <PeriodLabel active={!yearly} onSelect={() => setYearly(false)}>
          Monthly
        </PeriodLabel>
        {/* The shared switch extends its own hit area to 52x38; the 16px gap
            either side keeps that clear of the two labels, which are targets
            of their own. */}
        <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Bill yearly" />
        <PeriodLabel active={yearly} onSelect={() => setYearly(true)}>
          Yearly
        </PeriodLabel>
        <span className="rounded-full bg-brand-alt/10 px-2.5 py-0.5 text-xs text-brand-alt">
          Save 25%
        </span>
      </div>

      <div className="mx-auto grid max-w-[880px] grid-cols-1 gap-5 sm:grid-cols-2">
        <PlanCard
          {...FREE_PLAN}
          action={planCta('free', viewer, FREE_PLAN.cta)}
          onCheckout={upgrade}
          pending={false}
        />
        <PlanCard
          {...PRO_PLAN}
          {...billing}
          action={planCta('pro', viewer, PRO_PLAN.cta)}
          onCheckout={upgrade}
          pending={isPending}
        />
      </div>
    </>
  );
}
