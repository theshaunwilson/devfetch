import { BillingToggle } from '@/components/home/BillingToggle';
import { Reveal } from '@/components/home/Reveal';
import { SectionHead } from '@/components/home/SectionHead';
import { SHELL } from '@/components/home/content';

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border py-[clamp(72px,10vw,128px)]">
      <div className={SHELL}>
        <SectionHead
          title="Simple pricing"
          body="Start free and stay free. Upgrade when your stash outgrows it."
        />
        <Reveal>
          <BillingToggle />
        </Reveal>
      </div>
    </section>
  );
}
