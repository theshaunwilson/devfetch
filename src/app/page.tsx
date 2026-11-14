import type { Metadata } from 'next';
import { AiSection } from '@/components/home/AiSection';
import { ClosingCta } from '@/components/home/ClosingCta';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { Hero } from '@/components/home/Hero';
import { HomeNav } from '@/components/home/HomeNav';
import { PricingSection } from '@/components/home/PricingSection';
import { SiteFooter } from '@/components/home/SiteFooter';
import { Toaster } from '@/components/ui/sonner';
import { MAIN_CONTENT_ID } from '@/lib/constants';
import { isProUser } from '@/lib/db/billing';
import { getCurrentUser } from '@/lib/db/user';
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';

export const metadata: Metadata = {
  // The homepage leads with the brand, so it opts out of the template.
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
};

/*
 * `getCurrentUser()` reads the session cookie, so this route is dynamic — the
 * price of offering a signed-in visitor the dashboard instead of a sign-up
 * form. Declared rather than inferred, as every other signed-in route here
 * declares it.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // `CurrentUser` deliberately carries no `isPro` — the sidebar row it was
  // shaped for does not render one — so the pricing cards need their own
  // lookup. Both are request-cached, and this route is already dynamic.
  const [user, isPro] = await Promise.all([getCurrentUser(), isProUser()]);

  return (
    /*
     * `#home-root` is what scopes the smooth scrolling and the fixed-nav
     * scroll padding in globals.css to this one route.
     */
    <div id="home-root">
      {/* The pricing cards can now start a checkout, and a failed one has to
          say so. Neither `AppShell` nor `/settings` covers this route, so
          without this the only failure path on the page would be silent. */}
      <Toaster position="bottom-right" />

      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="absolute -top-16 left-4 z-100 rounded-lg bg-foreground px-4 py-2.5 font-medium text-background transition-[top] duration-200 focus-visible:top-4"
      >
        Skip to content
      </a>

      <HomeNav signedIn={user !== null} />

      <main id={MAIN_CONTENT_ID}>
        <Hero signedIn={user !== null} />
        <FeaturesSection />
        <AiSection />
        <PricingSection isSignedIn={user !== null} isPro={isPro} />
        <ClosingCta signedIn={user !== null} />
      </main>

      <SiteFooter year={new Date().getFullYear()} />
    </div>
  );
}
