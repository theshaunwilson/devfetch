import { Reveal } from '@/components/home/Reveal';

interface SectionHeadProps {
  title: string;
  body: string;
}

/** The heading-and-standfirst block that opens Features and Pricing. */
export function SectionHead({ title, body }: SectionHeadProps) {
  return (
    <Reveal className="mb-9 max-w-[38rem] lg:mb-14">
      <h2 className="font-heading text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold tracking-[-0.03em] text-balance">
        {title}
      </h2>
      <p className="mt-3.5 text-pretty text-muted-foreground">{body}</p>
    </Reveal>
  );
}
