'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import { CopyButton, WindowDots } from '@/components/items/EditorChrome';
import { MarkdownPreview } from '@/components/items/MarkdownPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EDITOR_MAX_HEIGHT } from '@/lib/constants';
import { cn } from '@/lib/utils';

type Tab = 'write' | 'preview';

interface MarkdownEditorProps {
  value: string;
  /** Omitted for the read-only display in the drawer. */
  onChange?: (value: string) => void;
  readOnly?: boolean;
  minHeight?: number;
  className?: string;
  /** Names the textarea for assistive tech, since there is no real <label>. */
  ariaLabel?: string;
  'aria-invalid'?: boolean;
}

/**
 * A markdown editor with the same window chrome as the code editor, holding a
 * plain textarea to write in and a rendered preview to read.
 *
 * One component for both modes, as `CodeEditor` is: read-only offers Preview
 * alone, since there is nothing to write, and edit opens on Write with Preview
 * a tab away. Notes and prompts get this; snippets and commands keep Monaco.
 */
export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  // Taller than `CodeEditor`'s floor on purpose: a code fragment is usually a
  // few lines, where a note or a prompt is paragraphs, and an editor that
  // starts smaller than the prose it holds reads as a cramped box to type in.
  minHeight = 200,
  className,
  ariaLabel,
  'aria-invalid': ariaInvalid,
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<Tab>(readOnly ? 'preview' : 'write');

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as Tab)}
      className={cn(
        'gap-0 overflow-hidden rounded-lg border bg-card',
        ariaInvalid && 'border-destructive',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b bg-muted/40 py-1.5 pr-1.5 pl-3">
        <WindowDots />

        <div className="ml-auto flex items-center gap-1.5">
          <TabsList className="h-6 bg-transparent p-0">
            {/* Read-only keeps the tab rather than dropping to a bare label,
                so the panel still says what it is showing. */}
            {!readOnly && (
              <TabsTrigger value="write" className="h-6 px-2 text-[11px]">
                Write
              </TabsTrigger>
            )}
            <TabsTrigger value="preview" className="h-6 px-2 text-[11px]">
              Preview
            </TabsTrigger>
          </TabsList>

          <CopyButton value={value} label="Copy markdown" />
        </div>
      </div>

      {!readOnly && (
        <TabsContent value="write">
          <MarkdownTextarea
            value={value}
            onChange={onChange}
            minHeight={minHeight}
            ariaLabel={ariaLabel}
          />
        </TabsContent>
      )}

      <TabsContent value="preview">
        {value.trim() ? (
          // Fluid to the same ceiling the code editor uses, so the two panels
          // cannot outgrow each other in the same drawer. The scroll box is
          // out here so the preview itself stays a plain styled block.
          <div
            className="editor-scrollbars overflow-auto p-4"
            style={{ minHeight, maxHeight: EDITOR_MAX_HEIGHT }}
          >
            <MarkdownPreview value={value} />
          </div>
        ) : (
          <div
            className="flex items-center justify-center p-4 text-xs text-muted-foreground"
            style={{ minHeight }}
          >
            Nothing to preview yet.
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface MarkdownTextareaProps {
  value: string;
  onChange?: (value: string) => void;
  minHeight: number;
  ariaLabel?: string;
}

/**
 * The write half: a plain textarea that grows with its content.
 *
 * Autosizing is measured rather than calculated — `scrollHeight` is the only
 * thing that knows how tall wrapped text actually is — and the height is reset
 * to `auto` first so the measurement can shrink as well as grow.
 */
function MarkdownTextarea({ value, onChange, minHeight, ariaLabel }: MarkdownTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = ref.current;

    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      EDITOR_MAX_HEIGHT,
    )}px`;
  }, [value, minHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      aria-label={ariaLabel}
      spellCheck
      className="editor-scrollbars w-full resize-none bg-transparent p-4 font-mono text-xs leading-relaxed outline-none placeholder:text-muted-foreground"
      style={{ minHeight, maxHeight: EDITOR_MAX_HEIGHT }}
    />
  );
}
