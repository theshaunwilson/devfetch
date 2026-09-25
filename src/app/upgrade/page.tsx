import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BillingToggle } from '@/components/home/BillingToggle';
import { isProUser } from '@/lib/db/billing';

export const metadata: Metadata = {
  title: 'Upgrade',
};

// Reads the signed-in user's plan per request, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

export default async function UpgradePage() {
  // Request-cached, and `AppShell` has already asked for the create dialog's
  // gate — so this page's guard costs no query of its own.
  const isPro = await isProUser();

  // Nothing here is for a paying account: a second checkout would open a
  // second subscription against it, which `startCheckout` refuses anyway. The
  // settings card is where a plan is changed, so that is where they go — the
  // same answer `planCta` gives a Pro viewer on the homepage.
  if (isPro) {
    redirect('/settings');
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-[880px]">
        <header className="mb-9 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Upgrade to Pro</h1>
          <p className="mt-2 text-muted-foreground">
            Take the limits off your stash. Change or cancel any time from Settings.
          </p>
        </header>

        {/*
          The homepage's own pricing control, not a second copy of it: it holds
          the Monthly/Yearly state, resolves each card's button through
          `planCta` and calls `startCheckout` itself.

          `isSignedIn` is a literal because the proxy refuses an anonymous
          request to this route, and `isPro` is narrowed to `false` by the
          redirect above — so the Pro card resolves to a checkout button and the
          Free card to a link back to the dashboard, which doubles as the way
          out of this page. Its failure toasts land in the `<Toaster />`
          `AppShell` mounts.
        */}
        <BillingToggle isSignedIn isPro={isPro} />
      </div>
    </div>
  );
}
