import { Check } from 'lucide-react';
import { Reveal } from '@/components/home/Reveal';
import { AI_CHECKLIST, AI_TAGS, SHELL } from '@/components/home/content';
import { WindowDots } from '@/components/items/EditorChrome';
import { Badge } from '@/components/ui/badge';
import { brightTextColorClass, softBgColorClass } from '@/lib/colors';
import { cn } from '@/lib/utils';

/**
 * A line of the mocked editor. The gutter number is `user-select-none` so
 * selecting the sample copies the code rather than the line numbers.
 */
function CodeLine({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <>
      <span className="mr-4.5 inline-block w-8 text-right text-muted-foreground/70 select-none">
        {n}
      </span>
      {children}
      {'\n'}
    </>
  );
}

export function AiSection() {
  return (
    <section className="border-t border-border py-[clamp(72px,10vw,128px)]">
      <div className={cn(
          SHELL,
          // `grid-cols-1` rather than an implicit single track: an implicit
          // `auto` column is sized by its content's min-content, and the
          // editor's code block made it 539px wide inside a 390px viewport.
          // Tailwind's numeric `grid-cols-*` emit `minmax(0, 1fr)`, which is
          // what stops a track outgrowing its container.
          'grid grid-cols-1 items-center gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16'
        )}>
        <Reveal>
          {/* The prototype's purple Pro pill, in the blue the dashboard uses. */}
          <Badge
            variant="outline"
            className="border-blue-500/45 bg-blue-500/10 text-[0.6875rem] tracking-[0.12em] text-blue-500 uppercase"
          >
            Pro
          </Badge>
          <h2 className="mt-4.5 font-heading text-[clamp(1.75rem,3.6vw,2.5rem)] font-semibold tracking-[-0.03em] text-balance">
            Let AI do the filing
          </h2>
          <p className="mt-3.5 text-pretty text-muted-foreground">
            Saving something should take one paste, not a naming decision. DevFetch reads what you
            saved and fills in the rest.
          </p>
          <ul className="mt-7 flex flex-col gap-3.5">
            {AI_CHECKLIST.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span
                  className="mt-0.75 grid size-5 flex-none place-items-center rounded-full bg-emerald-500/10 text-emerald-500"
                  aria-hidden="true"
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <figure className="m-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex h-10.5 items-center gap-3.5 border-b border-border bg-muted/40 px-3.5">
              <WindowDots />
              <span className="font-mono text-xs">useDebounce.ts</span>
              <span className="ml-auto font-mono text-[0.6875rem] text-muted-foreground">
                typescript
              </span>
            </div>

            {/*
              The sample is highlighted in three item-type accents rather than
              an editor theme's own hexes: keyword blue, function yellow and
              number emerald, which are the hues the prototype used and which
              keep purple out of the page's chrome.
            */}
            <pre className="m-0 overflow-x-auto px-4.5 py-4 font-mono text-[0.78rem] leading-[1.85]">
              <code>
                <CodeLine n={1}>
                  <span className="text-blue-500">export function</span>{' '}
                  <span className="text-yellow-300">useDebounce</span>&lt;T&gt;(value: T, delay ={' '}
                  <span className="text-emerald-500">300</span>) {'{'}
                </CodeLine>
                <CodeLine n={2}>
                  {'  '}
                  <span className="text-blue-500">const</span> [debounced, setDebounced] ={' '}
                  <span className="text-yellow-300">useState</span>(value);
                </CodeLine>
                <CodeLine n={3}>{''}</CodeLine>
                <CodeLine n={4}>
                  {'  '}
                  <span className="text-yellow-300">useEffect</span>(() =&gt; {'{'}
                </CodeLine>
                <CodeLine n={5}>
                  {'    '}
                  <span className="text-blue-500">const</span> id ={' '}
                  <span className="text-yellow-300">setTimeout</span>(() =&gt;{' '}
                  <span className="text-yellow-300">setDebounced</span>(value), delay);
                </CodeLine>
                <CodeLine n={6}>
                  {'    '}
                  <span className="text-blue-500">return</span> () =&gt;{' '}
                  <span className="text-yellow-300">clearTimeout</span>(id);
                </CodeLine>
                <CodeLine n={7}>
                  {'  '}
                  {'}'}, [value, delay]);
                </CodeLine>
                <CodeLine n={8}>{''}</CodeLine>
                <CodeLine n={9}>
                  {'  '}
                  <span className="text-blue-500">return</span> debounced;
                </CodeLine>
                <CodeLine n={10}>{'}'}</CodeLine>
              </code>
            </pre>

            <figcaption className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4.5 py-3.5">
              <span className="mr-1 text-sm text-muted-foreground">AI generated tags</span>
              {AI_TAGS.map(({ label, accent }) => (
                <Badge
                  key={label}
                  variant="outline"
                  className={cn(
                    'font-mono text-[0.6875rem]',
                    softBgColorClass(accent),
                    brightTextColorClass(accent)
                  )}
                >
                  {label}
                </Badge>
              ))}
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
