'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
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

/** How long the copy button stays confirmed before going back to its icon. */
const COPIED_FEEDBACK_MS = 2000;

interface CodeEditorProps {
  value: string;
  /** Omitted for the read-only display in the drawer. */
  onChange?: (value: string) => void;
  /** The item's own language text, mapped to a Monaco id inside the pane. */
  language?: string | null;
  readOnly?: boolean;
  minHeight?: number;
  className?: string;
  /** Names the editor for assistive tech, since there is no real <label>. */
  ariaLabel?: string;
  'aria-invalid'?: boolean;
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
  readOnly = false,
  minHeight = 120,
  className,
  ariaLabel,
  'aria-invalid': ariaInvalid,
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const label = languageLabel(language);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      // The live buffer, not the saved value: mid-edit, what is on screen is
      // what the user means by "copy this".
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (an insecure origin, or a denied
      // permission). Nothing was copied, so the button simply does not
      // confirm — a toast for a failed copy would be louder than the action.
    }
  }

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

        <div className="ml-auto flex items-center gap-1.5">
          {label && (
            <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            // The state is announced here rather than by swapping the label,
            // so a screen reader hears the confirmation the icon shows.
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>

      <CodeEditorPane
        value={value}
        onChange={onChange}
        language={language}
        readOnly={readOnly}
        minHeight={minHeight}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}

/** The traffic lights. Decorative, so they are hidden from assistive tech. */
function WindowDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="size-2.5 rounded-full bg-[#ff5f57]" />
      <span className="size-2.5 rounded-full bg-[#febc2e]" />
      <span className="size-2.5 rounded-full bg-[#28c840]" />
    </div>
  );
}
