# Homepage

## Overview

Replace the placeholder `/` with the real marketing homepage, built from the mockup in
`prototypes/homepage/`. Same sections, copy and behaviour, rebuilt in React with Tailwind
and shadcn, split into server and client components.

The prototype stays in place as the reference — do not delete it.

## Route

- Replaces `src/app/page.tsx`. Public: leave `/` out of the proxy matcher.
- A signed-in visitor gets a single **Go to dashboard** link in the nav instead of
  Sign in / Get started — resolve with `getCurrentUser()` in the page.
- Page metadata takes the title and description from the prototype's `<head>`.

## Component Split

**Server components** (default — no `'use client'`):

- `src/app/page.tsx` — composes the sections, resolves the session
- Nav shell, hero copy, dashboard preview, features grid, AI section, pricing plan
  content, closing CTA, footer
- Footer copyright year: `new Date().getFullYear()`, rendered on the server

**Client components** — one job each, in `src/components/home/`:

| Component        | Responsibility                                                                     |
| ---------------- | ---------------------------------------------------------------------------------- |
| `ChaosField`     | rAF drift, wall bounce, rotation/scale pulse, pointer repel; pauses offscreen and on tab hide |
| `NavScrollState` | Nav background opacity and border past 8px of scroll                                |
| `Reveal`         | IntersectionObserver fade-in wrapper, takes `children` so any section can use it     |
| `BillingToggle`  | Monthly/yearly switch; owns the Pro amount, period and note                          |

## Sections

Match the prototype's structure and copy:

1. Skip link and fixed nav (brand, Features/Pricing links, auth actions)
2. Hero — headline, subhead, CTAs, then chaos panel → arrow → dashboard preview
3. Features — 6 cards, each in its item-type accent
4. AI — Pro badge, checklist, editor mockup with AI-generated tags
5. Pricing — billing toggle, Free and Pro plans, Pro flagged "Most popular"
6. Closing CTA
7. Footer — brand, link columns, copyright

## Links

| Element                                                              | Destination           |
| -------------------------------------------------------------------- | --------------------- |
| Sign in                                                               | `/sign-in`            |
| Get started · Start for free · Create your free account · both plan buttons | `/register`      |
| Go to dashboard (signed in)                                           | `/dashboard`          |
| Features · See how it works                                           | `#features`           |
| Pricing                                                               | `#pricing`            |
| Brand mark (nav and footer)                                           | `#top`                |

Footer **Resources** and **Company** entries (Docs, Guides, Changelog, About, Blog,
Contact) have no destination — render them as plain text, not links. Nothing on the page
points at a route that does not exist.

## Styling

**The binding rule: the homepage uses the dashboard's colorway exactly — no new colours.**
Every colour on the page must resolve to either a theme token in `src/app/globals.css` or a
class from `src/lib/colors.ts`. No hex literals, no `color-mix`, no inline styles and none
of the prototype's own custom properties in a homepage component.

That colorway, as the dashboard already uses it:

- **Chrome is grayscale.** `bg-background`, `bg-card`, `bg-muted`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `ring-ring`. In dark mode every one of these is
  a neutral, and nothing in the dashboard tints them.
- **Colour only ever comes from an item type**, and only through `lib/colors.ts` —
  `textColorClass`, `borderColorClass`, `softBgColorClass`. The seven accents are
  `blue-500` (snippet), `violet-500` (prompt), `orange-500` (command), `yellow-300` (note),
  `gray-500` (file), `pink-500` (image), `emerald-500` (link).
- **Buttons are shadcn `Button` variants unchanged.** The prototype already paints its
  primary CTA near-white on near-black, which is what `bg-primary` resolves to in dark
  mode — so `default`, `outline` and `ghost` map across with nothing to restyle.

Where the prototype diverges from that, the dashboard wins:

| Prototype                                            | Use instead                                     |
| ---------------------------------------------------- | ----------------------------------------------- |
| `--line-strong` (white 18%) on outline buttons        | `border-border` — the dashboard has one border value |
| Hero title gradient through `#a5b4fc` (indigo)        | A gradient in `blue-500`/`emerald-500`, or plain `text-foreground` |
| Every chrome purple (focus ring, Pro badge, plan highlight, flag, bullets, favicon) | `blue-500` |
| `--accent` custom property on cards, tags and minis   | The `lib/colors.ts` class for that type          |

The one colour in the theme that is **not** in this palette is `--sidebar-primary`
(`oklch(0.488 0.243 264.376)`), used solely as the fill behind the current brand icon.
Dropping that tile retires it, which is what makes the two colorways identical rather than
merely similar.

Other styling:

- Tailwind v4 utilities only. No `tailwind.config`.
- shadcn: `Button` (`asChild` + `Link`) for every CTA, `Card` for feature and plan cards,
  `Badge` for "Pro" and "Most popular", `Switch` for billing. All four already exist.
- Fonts: Space Grotesk and JetBrains Mono through `next/font/google` in the root layout as
  CSS variables — self-hosted, no `<link>` to Google. Geist stays the default `--font-sans`.

## Branding

- Mark: the prototype's three-layer stack, no filled tile.
- Its gradient runs `blue-500` → `emerald-500` — the Snippet and Link accents, so the mark
  introduces no colour the dashboard does not already show. Drop the prototype's
  purple midpoint.
- The **Prompt item type** keeps `violet-500` wherever a prompt is being represented — it
  is the seeded colour, and turning it blue would make it indistinguishable from Snippet.
  Purple goes from the page's chrome, not from the type.
- One shared `BrandMark` component for the homepage and the app shell. Give each instance
  a unique SVG gradient id (`useId`): up to three `Brand`s render in one document.

## Accessibility & Motion

- Honour `prefers-reduced-motion` in all four client components: chips static but still
  scattered, no arrow pulse, and every reveal target visible immediately.
- Keep the skip link, `aria-hidden` on decorative SVGs, `role="switch"` with `aria-checked`
  on the billing toggle, and a visible focus ring on every interactive element.
- `scroll-padding-top` clears the fixed nav on anchor jumps.

## Responsive

- Chaos, arrow and preview stack below `lg`. The mobile arrow points down via a rotated
  SVG with vertical margin — not the `rotate` property, which turns the glyph without
  changing its layout box.
- Nav: section links hide below `sm`, the wordmark drops below 380px, and both auth
  actions stay reachable at every width.
- No horizontal page overflow at 320, 390, 768 or 1440.

## Notes

- No database, no server action, no new utility — so nothing here falls in the unit test
  scope. Verify in the browser.
- Keep it DRY: one `Reveal`, one `BrandMark`, one feature-card component driven by data,
  one plan component taking props. Section copy can live in a module-level array rather
  than being repeated in JSX.
