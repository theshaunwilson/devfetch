import Link from 'next/link';
import { ChaosField } from '@/components/home/ChaosField';
import { DashboardPreview } from '@/components/home/DashboardPreview';
import { REGISTER_PATH, SHELL } from '@/components/home/content';
import { Button } from '@/components/ui/button';

/**
 * Chaos on the left, order on the right, an arrow between them. The whole
 * page's idea in one row — which is why it is the one thing above the fold
 * besides the headline.
 */
export function Hero() {
  return (
    <section id="top" className="pt-[calc(64px+clamp(40px,6vw,76px))] pb-[clamp(64px,9vw,104px)]">
      <div className={SHELL}>
        <div className="mx-auto max-w-[44rem] text-center">
          <h1 className="bg-linear-to-r from-foreground from-38% via-blue-500 via-68% to-emerald-500 bg-clip-text font-heading text-[clamp(2.3rem,5.6vw,3.75rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-transparent">
            Stop Losing Your Developer Knowledge
          </h1>
          <p className="mt-5.5 text-[clamp(1rem,1.6vw,1.1875rem)] text-pretty text-muted-foreground">
            Your snippets are in VS Code, your prompts are in a chat history, your commands are
            in{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground">
              .bash_history
            </code>
            . DevFetch keeps all of it in one place you can actually search.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild className="h-12 grow px-6 text-[0.9375rem] sm:grow-0">
              <Link href={REGISTER_PATH}>Start for free</Link>
            </Button>
            <Button asChild variant="outline" className="h-12 grow px-6 text-[0.9375rem] sm:grow-0">
              <Link href="#features">See how it works</Link>
            </Button>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 items-center gap-4 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-7">
          <figure className="m-0 flex min-w-0 flex-col gap-3">
            <figcaption className="text-sm text-muted-foreground">
              Your knowledge today&hellip;
            </figcaption>
            <ChaosField />
          </figure>

          {/*
            The glyph is rotated, not swapped — but a rotation changes nothing
            about the layout box, so a 52x26 arrow painted 26x52 would overlap
            the panel below it. The vertical margin gives those 13px back.
          */}
          <svg
            viewBox="0 0 48 24"
            fill="none"
            aria-hidden="true"
            className="block h-6.5 w-13 justify-self-center text-muted-foreground opacity-85 max-lg:my-[13px] max-lg:rotate-90 motion-safe:animate-home-arrow"
          >
            <path d="M2 12h40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path
              d="m34 4 8 8-8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <figure className="m-0 flex min-w-0 flex-col gap-3">
            <figcaption className="text-sm text-foreground">&hellip;with DevFetch</figcaption>
            <DashboardPreview />
          </figure>
        </div>
      </div>
    </section>
  );
}
