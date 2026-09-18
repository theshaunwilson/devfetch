import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
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
            accessible name. Below 380px the bar is fixed, so its overflow
            would clip the last action rather than scroll the page.
          */}
          <span className="text-[1.0625rem] max-[380px]:sr-only">DevFetch</span>
        </Link>

        <nav aria-label="Sections" className="mr-auto hidden gap-6 text-sm sm:flex">
          <Link href="#features" className="text-muted-foreground transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">
            Pricing
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2.5 sm:ml-0">
          {signedIn ? (
            <Button asChild className="h-9 px-4">
              <Link href={DASHBOARD_PATH}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="h-9 px-3.5 sm:px-4">
                <Link href={SIGN_IN_PATH}>Sign in</Link>
              </Button>
              <Button asChild className="h-9 px-3.5 sm:px-4">
                <Link href={REGISTER_PATH}>Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </NavScrollState>
  );
}
