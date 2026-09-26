'use client';

import { WandSparkles } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { generateSummary } from '@/actions/ai';
import { ItemFieldError } from '@/components/items/ItemFieldError';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpgradeToast } from '@/hooks/use-upgrade-toast';
import type { GenerateSummaryInput } from '@/lib/validation/ai';

/**
 * The item as it stands in the form — what a description is written from.
 * Only the fields the selected type shows, as with the save payload.
 */
export type SummarySource = GenerateSummaryInput;

interface ItemDescriptionFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  messages?: string[];
  /**
   * Where a description is written from. Omitted for a free account, which
   * hides the button entirely — the action refuses regardless, so this is
   * presentation, not the gate.
   */
  summarizeFrom?: SummarySource;
}

/**
 * The Description textarea, plus an AI-written description for Pro accounts.
 *
 * An empty field is filled straight away. A field that already holds text is
 * never overwritten silently: the summary waits beneath it with Replace and
 * Discard. Nothing is saved until the form's own Save.
 */
export function ItemDescriptionField({
  id,
  value,
  onChange,
  rows,
  messages,
  summarizeFrom,
}: ItemDescriptionFieldProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [isPending, startTransition] = useTransition();
  const upgradeToast = useUpgradeToast();

  // Whether the field is empty is decided when the summary *arrives*, not
  // when it was asked for: somebody who starts typing while it is on its way
  // should get the Replace prompt, not have their words overwritten.
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const hasSource = Boolean(
    summarizeFrom &&
      [summarizeFrom.title, summarizeFrom.content, summarizeFrom.url, summarizeFrom.fileName].some(
        (text) => text?.trim(),
      ),
  );

  function handleSummarize() {
    if (!summarizeFrom) return;

    startTransition(async () => {
      const result = await generateSummary(summarizeFrom);

      if (!result.success) {
        if (result.upgradeRequired) {
          upgradeToast(result.error);
        } else {
          toast.error(result.error);
        }

        return;
      }

      if (valueRef.current.trim()) {
        setSuggestion(result.data.summary);
        setAnnouncement('Description suggested. Replace or discard it below the field.');
      } else {
        onChange(result.data.summary);
        setSuggestion(null);
        setAnnouncement('Description written.');
      }
    });
  }

  function replace() {
    if (suggestion) onChange(suggestion);
    setSuggestion(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label htmlFor={id}>Description</Label>

        {summarizeFrom && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSummarize}
            disabled={isPending || !hasSource}
          >
            <WandSparkles aria-hidden="true" />
            {isPending ? 'Generating…' : 'Generate Description'}
          </Button>
        )}
      </div>

      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(messages?.length)}
        rows={rows}
      />

      {suggestion && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed bg-muted/40 p-3">
          <p className="text-sm wrap-anywhere">{suggestion}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSuggestion(null)}>
              Discard
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={replace}>
              Replace
            </Button>
          </div>
        </div>
      )}

      {/* Announces arrival, since focus stays on the button. */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <ItemFieldError messages={messages} />
    </div>
  );
}
