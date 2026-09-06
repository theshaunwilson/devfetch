'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
  value: string;
  className?: string;
}

/**
 * Rendered markdown, styled through the `.markdown-preview` class in
 * `globals.css`.
 *
 * The styling lives in CSS rather than in a `components` map because every
 * element markdown can produce needs a rule, and GFM adds tables and task
 * lists on top — a map of thirty components rendering nothing but a class name
 * each would be the same stylesheet written the long way round.
 *
 * Raw HTML stays disabled, which is `react-markdown`'s default: content is
 * whatever a user typed, so `rehype-raw` here would turn a saved note into
 * stored XSS.
 */
export function MarkdownPreview({ value, className }: MarkdownPreviewProps) {
  return (
    <div className={cn('markdown-preview', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Markdown links point wherever the author typed, so they open away
          // from the app and cannot reach back through `window.opener`.
          //
          // The anchor's props are named rather than spread: `react-markdown`
          // hands every component the hast `node` too, and spreading that puts
          // a literal `node="[object Object]"` attribute on the anchor.
          a: ({ href, title, children }) => (
            <a href={href} title={title} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {value}
      </Markdown>
    </div>
  );
}
