import { Reveal } from '@/components/home/Reveal';
import { SectionHead } from '@/components/home/SectionHead';
import { FEATURES, SHELL } from '@/components/home/content';
import { Card } from '@/components/ui/card';
import { softBgColorClass, textColorClass } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-border py-[clamp(72px,10vw,128px)]">
      <div className={SHELL}>
        <SectionHead
          title="One place for everything you keep"
          body="Seven kinds of thing, one hub. Save it once, find it from anywhere, and stop paying the tax of remembering where you put it."
        />

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, body, icon: Icon, accent }) => (
            <li key={title}>
              <Reveal className="h-full">
                <Card className="h-full gap-0 px-6 py-6.5">
                  <span
                    className={cn(
                      'mb-4.5 grid size-10 place-items-center rounded-lg',
                      softBgColorClass(accent),
                      textColorClass(accent)
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">{title}</h3>
                  <p className="mt-2.5 text-pretty text-muted-foreground">{body}</p>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
