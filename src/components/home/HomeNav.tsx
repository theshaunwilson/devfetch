import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { HomeMobileMenu } from '@/components/home/HomeMobileMenu';
import { NavScrollState } from '@/components/home/NavScrollState';
import { DASHBOARD_PATH, REGISTER_PATH, SHELL, SIGN_IN_PATH } from '@/components/home/content';
import { Button } from '@/components/ui/button';

interface HomeNavProps {
  /** A visitor with a session is offered the app, not an account. */
  signedIn: boolean;
}

export function HomeNav({ signedIn }: HomeNavProps) {
  return (
    <NavScrollState>
      <div className={`${SHELL} flex h-16 items-center gap-3.5 sm:gap-8`}>
        <Link
          href="#top"
          className="flex shrink-0 items-center gap-2.5 rounded-lg font-display font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <BrandMark />
          {/*
            `sr-only` rather than `hidden`: the mark is an unlabelled icon, so
            hiding the wordmark outright would leave this link with no
            accessible name. The bar is fixed, so its overflow clips the last
            action rather than scrolling the page — hence a threshold at all.
            It sits at 340px rather than 380 because 375 is an ordinary phone
            width (SE, 12/13 mini) where the bar has room to spare: measured
            with the section links moved into the menu, the row needs 290px of
            the 335 available.
          */}
          <span className="text-[1.0625rem] max-[340px]:sr-only">DevFetch</span>
        </Link>

        <nav aria-label="Sections" className="mr-auto hidden gap-6 text-sm sm:flex">
          {/* `py-1` lifts these off a 20px line box, under the 24px minimum. */}
          <Link href="#features" className="py-1 text-muted-foreground transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="#pricing" className="py-1 text-muted-foreground transition-colors hover:text-foreground">
            Pricing
          </Link>
        </nav>

        {/*
          `h-10 sm:h-9`: 36px clears the 24px minimum but sits under the 44px
          touch guidance, and this is the page's primary conversion control.
          Sign in drops to the menu below `sm` so the CTA keeps the bar.
        */}
        <div className="ml-auto flex items-center gap-2 sm:ml-0 sm:gap-2.5">
          {signedIn ? (
            <Button asChild className="h-10 px-4 sm:h-9">
              <Link href={DASHBOARD_PATH}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden h-9 px-4 sm:inline-flex">
                <Link href={SIGN_IN_PATH}>Sign in</Link>
              </Button>
              <Button asChild className="h-10 px-3.5 sm:h-9 sm:px-4">
                <Link href={REGISTER_PATH}>Get started</Link>
              </Button>
            </>
          )}
          <HomeMobileMenu signedIn={signedIn} />
        </div>
      </div>
    </NavScrollState>
  );
}
