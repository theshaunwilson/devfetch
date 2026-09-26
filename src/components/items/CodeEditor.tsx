'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import { CopyButton, WindowDots } from '@/components/items/EditorChrome';
import { languageLabel } from '@/lib/code-language';
import { cn } from '@/lib/utils';

// Monaco is browser-only and heavy, so it stays out of the initial bundle and
// off the server render. The placeholder holds the editor's minimum height, so
// the surrounding form does not jump when the real thing arrives.
const CodeEditorPane = dynamic(
  () => import('@/components/items/CodeEditorPane').then((module) => module.CodeEditorPane),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-30 w-full items-center justify-center text-xs text-muted-foreground">
        Loading editor…
      </div>
    ),
  },
);

interface CodeEditorProps {
  value: string;
  /** Omitted for the read-only display in the drawer. */
  onChange?: (value: string) => void;
  /** The item's own language text, mapped to a Monaco id inside the pane. */
  language?: string | null;
  /**
   * Whether the header names the language. The drawer's read view turns it
   * off: its own header already shows the language as a badge, a few pixels
   * above, and the two read as a duplicate. The forms keep it, since nothing
   * else there shows the language next to the code.
   */
  showLanguage?: boolean;
  readOnly?: boolean;
  minHeight?: number;
  className?: string;
  /** Names the editor for assistive tech, since there is no real <label>. */
  ariaLabel?: string;
  'aria-invalid'?: boolean;
  /**
   * Header slots for the drawer's read view, which is the only caller that
   * passes them: `tabs` sits before the language label and `actions` before the
   * copy button. The forms render the editor without either.
   */
  tabs?: ReactNode;
  actions?: ReactNode;
  /**
   * Wraps the editor pane, so a caller can put it in a tab beside something
   * else rather than replace it. Omitted, the pane renders as is.
   */
  body?: (pane: ReactNode) => ReactNode;
  /** What the copy button copies, when the visible panel is not the code. */
  copy?: { value: string; label: string };
}

/**
 * A code editor with macOS window chrome — the three dots, the language and a
 * copy button — wrapped around Monaco.
 *
 * One component for both modes: the drawer renders it read-only to display an
 * item, and the edit and create forms render it writable. Everything except
 * `readOnly` is identical, which is what keeps a snippet looking the same
 * while it is being read and while it is being changed.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  showLanguage = true,
  readOnly = false,
  minHeight = 120,
  className,
  ariaLabel,
  'aria-invalid': ariaInvalid,
  tabs,
  actions,
  body,
  copy,
}: CodeEditorProps) {
  const label = showLanguage ? languageLabel(language) : null;
  const pane = (
    <CodeEditorPane
      value={value}
      onChange={onChange}
      language={language}
      readOnly={readOnly}
      minHeight={minHeight}
      ariaLabel={ariaLabel}
    />
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card',
        ariaInvalid && 'border-destructive',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b bg-muted/40 py-1.5 pr-1.5 pl-3">
        <WindowDots />

        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          {tabs}

          {label && (
            <span className="truncate font-mono text-[11px] text-muted-foreground">{label}</span>
          )}

          {actions}

          <CopyButton value={copy?.value ?? value} label={copy?.label ?? 'Copy code'} />
        </div>
      </div>

      {body ? body(pane) : pane}
    </div>
  );
}
