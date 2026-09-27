'use client';

import { Check, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { optimizePrompt } from '@/actions/ai';
import { updateItemContent } from '@/actions/items';
import { AiHeaderButton } from '@/components/items/AiHeaderButton';
import { MarkdownEditor } from '@/components/items/MarkdownEditor';
import { MarkdownPreview } from '@/components/items/MarkdownPreview';
import { Button } from '@/components/ui/button';
import { useFailureToast, useUpgradeToast } from '@/hooks/use-upgrade-toast';
import { EDITOR_MAX_HEIGHT } from '@/lib/constants';
import type { ItemDetail } from '@/types/item';

const PRO_MESSAGE = 'AI prompt optimization is part of Pro. Upgrade to use it.';

const OPTIMIZE_HINT = 'Get an AI review of this prompt, with an improved version to use or discard';

const OPTIMIZED_TAB = 'optimized';

interface Suggestion {
  prompt: string;
  changes: string[];
}

interface OptimizablePromptEditorProps {
  itemId: string;
  value: string;
  minHeight?: number;
  ariaLabel?: string;
  isPro: boolean;
  /** Called with the saved item once an optimized prompt has been accepted. */
  onSaved: (item: ItemDetail) => void;
}

/**
 * The drawer's read-only prompt, with an AI optimization beside it.
 *
 * Optimize with AI sends the saved prompt for review. When the model finds
 * nothing worth changing, a toast says so and nothing else happens. When it
 * rewrites the prompt, an Optimized tab appears with the rewrite and the notes
 * on what changed, and asks whether to use it: accepting replaces the item's
 * content and saves, discarding drops the suggestion. Nothing is written until
 * the user accepts. The caller keys this by item id, so opening another item
 * starts with no suggestion.
 */
export function OptimizablePromptEditor({
  itemId,
  value,
  minHeight,
  ariaLabel,
  isPro,
  onSaved,
}: OptimizablePromptEditorProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [tab, setTab] = useState('preview');
  const [announcement, setAnnouncement] = useState('');
  const [isOptimizing, startOptimizing] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const upgradeToast = useUpgradeToast();
  const failureToast = useFailureToast();

  function handleOptimize() {
    startOptimizing(async () => {
      const result = await optimizePrompt({ itemId });

      if (!result.success) {

        failureToast(result);

        return;
      }

      if (!result.data.changed) {
        // A previous suggestion is dropped too: the latest review says the
        // saved prompt holds up, and offering the older rewrite beside that
        // would contradict it.
        setSuggestion(null);
        setTab('preview');
        toast.success('This prompt already holds up. No changes suggested.');
        return;
      }

      setSuggestion({ prompt: result.data.prompt, changes: result.data.changes });
      setTab(OPTIMIZED_TAB);
      setAnnouncement('Optimized prompt ready to review.');
    });
  }

  function discard() {
    setSuggestion(null);
    setTab('preview');
    setAnnouncement('Optimized prompt discarded.');
  }

  function accept(prompt: string) {
    startSaving(async () => {
      const result = await updateItemContent(itemId, prompt);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setSuggestion(null);
      setTab('preview');
      toast.success('Prompt updated');
      // Patches the drawer's own copy of the item and refreshes the lists
      // behind it — the same path an edit takes.
      onSaved(result.data);
    });
  }

  const showingSuggestion = suggestion !== null && tab === OPTIMIZED_TAB;

  return (
    <>
      <MarkdownEditor
        value={value}
        readOnly
        minHeight={minHeight}
        ariaLabel={ariaLabel}
        tab={tab}
        onTabChange={setTab}
        panels={
          suggestion
            ? [
                {
                  value: OPTIMIZED_TAB,
                  label: 'Optimized',
                  content: (
                    <SuggestionPanel
                      suggestion={suggestion}
                      minHeight={minHeight}
                      isSaving={isSaving}
                      onAccept={() => accept(suggestion.prompt)}
                      onDiscard={discard}
                    />
                  ),
                },
              ]
            : []
        }
        actions={
          <AiHeaderButton
            isPro={isPro}
            label={suggestion ? 'Regenerate' : 'Optimize with AI'}
            pendingLabel="Optimizing…"
            isPending={isOptimizing}
            hint={suggestion ? 'Ask the AI for another version of this prompt' : OPTIMIZE_HINT}
            onClick={handleOptimize}
            onUpgrade={() => upgradeToast(PRO_MESSAGE)}
          />
        }
        copy={
          showingSuggestion
            ? { value: suggestion.prompt, label: 'Copy optimized prompt' }
            : undefined
        }
      />

      {/* Announces arrival, since focus stays on the button. */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

interface SuggestionPanelProps {
  suggestion: Suggestion;
  minHeight?: number;
  isSaving: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}

/**
 * The rewrite and what changed, in the space the prompt occupies, then the
 * question. The scroll box holds the text only, so Use and Discard stay in view
 * however long the prompt is. `MarkdownPreview` keeps raw HTML disabled, which
 * is what makes rendering model output safe.
 */
function SuggestionPanel({ suggestion, minHeight, isSaving, onAccept, onDiscard }: SuggestionPanelProps) {
  return (
    <div className="flex flex-col">
      <div
        className="editor-scrollbars flex flex-col gap-4 overflow-auto p-4"
        style={{ minHeight, maxHeight: EDITOR_MAX_HEIGHT }}
      >
        {suggestion.changes.length > 0 && (
          <section className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3">
            <h4 className="text-xs font-medium">What changed</h4>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
              {suggestion.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </section>
        )}

        <MarkdownPreview value={suggestion.prompt} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-4 py-3">
        <p className="mr-auto text-xs text-muted-foreground">
          Use this optimized prompt? It replaces the saved one.
        </p>

        {/* Grouped, so on a narrow drawer the pair wraps together and stays
            right-aligned under the question rather than starting a new row
            at the left edge. */}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving}>
            <X aria-hidden="true" />
            Discard
          </Button>
          <Button type="button" size="sm" onClick={onAccept} disabled={isSaving}>
            <Check aria-hidden="true" />
            {isSaving ? 'Saving…' : 'Use this prompt'}
          </Button>
        </div>
      </div>
    </div>
  );
}
