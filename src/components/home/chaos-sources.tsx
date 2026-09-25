import type { ReactNode } from 'react';

export interface ChaosSource {
  name: string;
  icon: ReactNode;
}

/*
 * The eight places a developer's knowledge actually lives. Simplified marks
 * drawn by hand rather than official brand assets, and decorative: the whole
 * field is `aria-hidden`, so none of them needs a label.
 *
 * The filled marks carry more ink than the stroked ones and read brighter at
 * the same colour, so each is pulled back with `opacity-80` to match.
 */
export const CHAOS_SOURCES: ChaosSource[] = [
  {
    name: 'Notion',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <rect x="3.5" y="2.5" width="17" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 17V8l6 8.2V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: 'GitHub',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="size-5.5 opacity-80">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    ),
  },
  {
    name: 'Slack',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5.5 opacity-80">
        <path d="M5.1 15.1a2.1 2.1 0 1 1-2.1-2.1h2.1v2.1Zm1.05 0a2.1 2.1 0 0 1 4.2 0v5.25a2.1 2.1 0 1 1-4.2 0V15.1Z" />
        <path d="M8.25 5.1a2.1 2.1 0 1 1 2.1-2.1v2.1h-2.1Zm0 1.05a2.1 2.1 0 0 1 0 4.2H3a2.1 2.1 0 0 1 0-4.2h5.25Z" />
        <path d="M18.9 8.25a2.1 2.1 0 1 1 2.1 2.1h-2.1v-2.1Zm-1.05 0a2.1 2.1 0 0 1-4.2 0V3a2.1 2.1 0 1 1 4.2 0v5.25Z" />
        <path d="M15.75 18.9a2.1 2.1 0 1 1-2.1 2.1v-2.1h2.1Zm0-1.05a2.1 2.1 0 0 1 0-4.2H21a2.1 2.1 0 0 1 0 4.2h-5.25Z" />
      </svg>
    ),
  },
  {
    name: 'VS Code',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5.5 opacity-80">
        <path d="M17.6 2.2 9.8 9.5 5.6 6.3 4 7l3.4 5L4 17l1.6.7 4.2-3.2 7.8 7.3L21 20V4l-3.4-1.8Zm.3 4.6v10.4l-5.4-5.2 5.4-5.2Z" />
      </svg>
    ),
  },
  {
    name: 'Browser tabs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 10h19M9 4.5V10M15 4.5V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'Terminal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <path d="m4 17 6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: 'Text file',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 2v5h5M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: 'Bookmark',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5.5">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];
