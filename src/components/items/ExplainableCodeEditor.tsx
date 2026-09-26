'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { explainCode } from '@/actions/ai';
import { AiHeaderButton } from '@/components/items/AiHeaderButton';
import { CodeEditor } from '@/components/items/CodeEditor';
import { MarkdownPreview } from '@/components/items/MarkdownPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUpgradeToast } from '@/hooks/use-upgrade-toast';
import { EDITOR_MAX_HEIGHT } from '@/lib/constants';

const PRO_MESSAGE = 'AI code explanations are part of Pro. Upgrade to use them.';

/** What the button promises, said once for both the Pro and the free tooltip. */
const EXPLAIN_HINT = 'Get a plain-language AI explanation of this code';

interface Explanation {
  text: string;
  truncated: boolean;
}

interface ExplainableCodeEditorProps {
  itemId: string;
  value: string;
  language?: string | null;
  minHeight?: number;
  ariaLabel?: string;
  isPro: boolean;
}

/**
 * The drawer's read-only code editor, with an AI explanation beside the code.
 *
 * The button is labelled "Explain with AI" and outlined, so it reads as an
 * action rather than as part of the window chrome. The first explanation adds
 * Code / Explanation tabs to the header and switches to Explanation; the
 * button then regenerates. Nothing is saved. The caller keys this
 * by item id, so opening another item starts with no explanation rather than
 * showing the previous item's.
 */
export function ExplainableCodeEditor({
  itemId,
  value,
  language,
  minHeight,
  ariaLabel,
  isPro,
}: ExplainableCodeEditorProps) {
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [tab, setTab] = useState<'code' | 'explain'>('code');
  const [isPending, startTransition] = useTransition();
  const upgradeToast = useUpgradeToast();

  function handleExplain() {
    startTransition(async () => {
      const result = await explainCode({ itemId });

      if (!result.success) {
        if (result.upgradeRequired) {
          upgradeToast(result.error);
        } else {
          toast.error(result.error);
        }

        return;
      }

      setExplanation({ text: result.data.explanation, truncated: result.data.truncated });
      setTab('explain');
    });
  }

  const showingExplanation = explanation !== null && tab === 'explain';

  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as 'code' | 'explain')} className="gap-0">
      <CodeEditor
        value={value}
        language={language}
        readOnly
        minHeight={minHeight}
        ariaLabel={ariaLabel}
        tabs={
          explanation && (
            <TabsList className="h-6 bg-transparent p-0">
              <TabsTrigger value="code" className="h-6 px-2 text-[11px]">
                Code
              </TabsTrigger>
              <TabsTrigger value="explain" className="h-6 px-2 text-[11px]">
                Explanation
              </TabsTrigger>
            </TabsList>
          )
        }
        actions={
          <AiHeaderButton
            isPro={isPro}
            label={explanation ? 'Regenerate' : 'Explain with AI'}
            pendingLabel="Explaining…"
            isPending={isPending}
            hint={explanation ? 'Write a new AI explanation of this code' : EXPLAIN_HINT}
            onClick={handleExplain}
            onUpgrade={() => upgradeToast(PRO_MESSAGE)}
          />
        }
        body={(pane) =>
          explanation ? (
            <>
              <TabsContent value="code">{pane}</TabsContent>
              <TabsContent value="explain">
                <ExplanationPanel explanation={explanation} minHeight={minHeight} />
              </TabsContent>
            </>
          ) : (
            pane
          )
        }
        copy={
          showingExplanation ? { value: explanation.text, label: 'Copy explanation' } : undefined
        }
      />

      {/* Announces arrival, since focus stays on the button. */}
      <p className="sr-only" aria-live="polite">
        {explanation ? 'Explanation ready.' : ''}
      </p>
    </Tabs>
  );
}

interface ExplanationPanelProps {
  explanation: Explanation;
  minHeight?: number;
}

/**
 * The explanation, rendered as markdown in the space the code occupies —
 * capped at the editor's own ceiling, so switching tabs does not resize the
 * drawer more than it has to. `MarkdownPreview` keeps raw HTML disabled, which
 * is what makes rendering model output safe.
 */
function ExplanationPanel({ explanation, minHeight }: ExplanationPanelProps) {
  return (
    <div
      className="editor-scrollbars flex flex-col gap-3 overflow-auto p-4"
      style={{ minHeight, maxHeight: EDITOR_MAX_HEIGHT }}
    >
      {explanation.truncated && (
        <p className="text-xs text-muted-foreground">
          This code is long, so only its beginning was explained.
        </p>
      )}

      <MarkdownPreview value={explanation.text} />

      <p className="text-xs text-muted-foreground">AI-generated. Check it before relying on it.</p>
    </div>
  );
}
