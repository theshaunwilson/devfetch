import type { Metadata } from 'next';
import { AiSection } from '@/components/home/AiSection';
import { ClosingCta } from '@/components/home/ClosingCta';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { Hero } from '@/components/home/Hero';
import { HomeNav } from '@/components/home/HomeNav';
import { PricingSection } from '@/components/home/PricingSection';
import { SiteFooter } from '@/components/home/SiteFooter';
import { MAIN_CONTENT_ID } from '@/lib/constants';
import { getCurrentUser } from '@/lib/db/user';

export const metadata: Metadata = {
  title: 'DevFetch — One place for everything you keep',
  description:
    'DevFetch is a searchable hub for the snippets, prompts, commands, notes, files and links developers scatter across a dozen tools.',
};

/*
 * `getCurrentUser()` reads the session cookie, so this route is dynamic — the
 * price of offering a signed-in visitor the dashboard instead of a sign-up
 * form. Declared rather than inferred, as every other signed-in route here
 * declares it.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    /*
     * `#home-root` is what scopes the smooth scrolling and the fixed-nav
     * scroll padding in globals.css to this one route.
     */
    <div id="home-root">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="absolute -top-16 left-4 z-100 rounded-lg bg-foreground px-4 py-2.5 font-medium text-background transition-[top] duration-200 focus-visible:top-4"
      >
        Skip to content
      </a>

      <HomeNav signedIn={user !== null} />

      <main id={MAIN_CONTENT_ID}>
        <Hero />
        <FeaturesSection />
        <AiSection />
        <PricingSection />
        <ClosingCta />
      </main>

      <SiteFooter year={new Date().getFullYear()} />
    </div>
  );
}
