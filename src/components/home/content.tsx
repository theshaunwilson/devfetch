import { Code, Folder, Image, Search, Sparkles, Terminal, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { DEFAULT_SIGNED_IN_PATH, SIGN_IN_PATH } from '@/lib/auth-redirect';
import { ITEM_TYPE_ACCENTS } from '@/lib/colors';

/*
 * Every word on the homepage that repeats a shape, kept as data so the JSX
 * stays a layout and the copy stays editable in one place.
 *
 * Colour arrives only as an item-type accent — `ITEM_TYPE_ACCENTS` holds the
 * same hexes the seed writes, and `lib/colors.ts` turns each into a class.
 */

/*
 * Sign-in and the dashboard already have canonical constants in
 * `lib/auth-redirect`; registration has never needed one, so it is named here
 * rather than added to a module the auth flow owns.
 */
export const REGISTER_PATH = '/register';
export { DEFAULT_SIGNED_IN_PATH as DASHBOARD_PATH, SIGN_IN_PATH };

/**
 * The page's content column: 1120px, with the gutter the prototype used.
 * A shared class string rather than a wrapper component — every section needs
 * its own outer element for full-bleed borders and backgrounds anyway.
 */
export const SHELL = 'mx-auto w-full max-w-280 px-5 sm:px-8';

/** Small helper for the monospace keycap that appears in two places. */
export function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-px font-mono text-[0.6875rem] text-muted-foreground">
      {children}
    </kbd>
  );
}

export interface FeatureCopy {
  title: string;
  body: ReactNode;
  icon: LucideIcon;
  accent: string;
}

export const FEATURES: FeatureCopy[] = [
  {
    title: 'Code snippets',
    icon: Code,
    accent: ITEM_TYPE_ACCENTS.snippet,
    body: 'The function you rewrite on every project, kept with its language and highlighting intact so it still reads like code when you paste it back.',
  },
  {
    title: 'AI prompts',
    icon: Sparkles,
    accent: ITEM_TYPE_ACCENTS.prompt,
    body: 'Keep the prompt that finally worked instead of scrolling a month of chat history looking for the version you liked.',
  },
  {
    title: 'Instant search',
    icon: Search,
    accent: ITEM_TYPE_ACCENTS.link,
    body: (
      <>
        One shortcut searches titles, tags, types and content at once. Press{' '}
        <Keycap>⌘K</Keycap> anywhere and start typing.
      </>
    ),
  },
  {
    title: 'Commands',
    icon: Terminal,
    accent: ITEM_TYPE_ACCENTS.command,
    body: 'The docker invocation, the port you always have to kill, the migration flag you look up every time. Saved with the reason you needed it.',
  },
  {
    title: 'Files & docs',
    icon: Image,
    accent: ITEM_TYPE_ACCENTS.image,
    body: 'Diagrams, screenshots, config files and templates, uploaded once and downloadable from the same place you keep everything else.',
  },
  {
    title: 'Collections',
    icon: Folder,
    accent: ITEM_TYPE_ACCENTS.note,
    body: 'Group anything with anything. React Patterns can hold a snippet, a prompt and a link without pretending they are the same thing.',
  },
];

export const AI_CHECKLIST = [
  'Tags every item the moment you save it',
  'Summarizes a long note into a line you can scan',
  'Explains unfamiliar code in plain language',
  'Turns a rough prompt into one that holds up',
];

/** The item type each AI-generated tag is shown in. */
export const AI_TAGS = [
  { label: 'react', accent: ITEM_TYPE_ACCENTS.snippet },
  { label: 'hooks', accent: ITEM_TYPE_ACCENTS.prompt },
  { label: 'typescript', accent: ITEM_TYPE_ACCENTS.link },
  { label: 'performance', accent: ITEM_TYPE_ACCENTS.command },
];

/** The sidebar rows in the hero's dashboard preview. */
export const PREVIEW_NAV = [
  { label: 'Dashboard', accent: null },
  { label: 'Snippets', accent: ITEM_TYPE_ACCENTS.snippet },
  { label: 'Prompts', accent: ITEM_TYPE_ACCENTS.prompt },
  { label: 'Commands', accent: ITEM_TYPE_ACCENTS.command },
  { label: 'Notes', accent: ITEM_TYPE_ACCENTS.note },
  { label: 'Links', accent: ITEM_TYPE_ACCENTS.link },
];

/** The item cards in the hero's dashboard preview. */
export const PREVIEW_ITEMS = [
  { title: 'useDebounce hook', meta: 'react · hooks', accent: ITEM_TYPE_ACCENTS.snippet },
  { title: 'Kill port 3000', meta: 'shell', accent: ITEM_TYPE_ACCENTS.command },
  { title: 'Code review prompt', meta: 'ai · review', accent: ITEM_TYPE_ACCENTS.prompt },
  { title: 'Prisma docs', meta: 'database', accent: ITEM_TYPE_ACCENTS.link },
  { title: 'Deploy checklist', meta: 'ops', accent: ITEM_TYPE_ACCENTS.note },
  { title: 'schema.prisma', meta: '4.2 KB', accent: ITEM_TYPE_ACCENTS.file },
];

export interface PlanCopy {
  name: string;
  pitch: string;
  amount: string;
  period: string;
  note: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

export const FREE_PLAN: PlanCopy = {
  name: 'Free',
  pitch: 'Everything you need to stop losing things.',
  amount: '$0',
  period: 'forever',
  note: 'No card required.',
  features: [
    '50 items',
    '3 collections',
    'Snippets, prompts, notes, commands and links',
    'Full-text search and the command palette',
    'Markdown and code editors',
  ],
  cta: 'Start for free',
};

export const PRO_PLAN: PlanCopy = {
  name: 'Pro',
  pitch: 'For the stash that keeps growing.',
  amount: '$8',
  period: 'per month',
  note: 'Or $72 a year, billed annually.',
  features: [
    'Unlimited items and collections',
    'File and image uploads',
    'Custom item types',
    'AI tagging, summaries, explanations and prompt tuning',
    'Export to JSON or ZIP',
  ],
  cta: 'Get DevFetch Pro',
  featured: true,
};

/** What the billing switch swaps in and out of the Pro plan. */
export const PRO_BILLING = {
  monthly: { amount: '$8', period: 'per month', note: 'Or $72 a year, billed annually.' },
  yearly: { amount: '$6', period: 'per month', note: 'Billed as $72 once a year.' },
};

export interface FooterColumn {
  heading: string;
  entries: { label: string; href: string }[];
}

/**
 * Every entry resolves to somewhere real.
 *
 * Resources (Docs, Guides, Changelog) and Company (About, Blog, Contact) used
 * to sit here without hrefs, rendering as plain text under link-styled
 * headings — which reads as six broken links rather than as six pages that do
 * not exist yet. They come back when they have somewhere to point.
 */
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    entries: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Get started', href: REGISTER_PATH },
    ],
  },
];
