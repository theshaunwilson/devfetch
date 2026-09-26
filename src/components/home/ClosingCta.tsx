import Link from 'next/link';
import { Reveal } from '@/components/home/Reveal';
import { DASHBOARD_PATH, REGISTER_PATH, SHELL } from '@/components/home/content';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Signed in, the button opens the dashboard rather than the sign-up form. */
export function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="border-t border-border py-[clamp(80px,11vw,140px)]">
      <Reveal className={cn(SHELL, 'text-center')}>
        <h2 className="font-heading text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold tracking-[-0.03em] text-balance">
          Ready to Organize Your Knowledge?
        </h2>
        <p className="mx-auto mt-4 max-w-[34rem] text-muted-foreground">
          It takes a paste to save your first snippet. Everything after that is search.
        </p>
        <Button asChild className="mt-7.5 h-12 px-6 text-[0.9375rem]">
          {signedIn ? (
            <Link href={DASHBOARD_PATH}>Open your dashboard</Link>
          ) : (
            <Link href={REGISTER_PATH}>Create your free account</Link>
          )}
        </Button>
      </Reveal>
    </section>
  );
}
