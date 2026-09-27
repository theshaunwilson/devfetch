'use client';

import { Check, WandSparkles, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { generateAutoTags } from '@/actions/ai';
import { ItemFieldError } from '@/components/items/ItemFieldError';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFailureToast } from '@/hooks/use-upgrade-toast';
import { appendTagInput, hasTagInput, tagsForAi } from '@/lib/items';

/** The item's text as it stands in the form — what tags are suggested from. */
export interface TagSuggestionSource {
  title: string;
  description?: string;
  content?: string;
  url?: string;
}

interface ItemTagsFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  messages?: string[];
  /**
   * Where suggestions come from. Omitted for a free account, which hides the
   * Suggest Tags button entirely — the action refuses them regardless, so
   * this is presentation, not the gate.
   */
  suggestFrom?: TagSuggestionSource;
}

/**
 * The Tags input, plus AI tag suggestions for Pro accounts.
 *
 * Suggestions land as badges under the input, each accepted or rejected on
 * its own. Accepting only edits the input's text; nothing is saved until the
 * form's own Save, so an unwanted tag costs nothing to undo.
 */
export function ItemTagsField({ id, value, onChange, messages, suggestFrom }: ItemTagsFieldProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const failureToast = useFailureToast();

  // Derived, not stored: a suggestion the user has since typed in themselves
  // stops being offered, and one they delete from the input again does not
  // come back — the list only ever shrinks.
  const offered = suggestions.filter((tag) => !hasTagInput(value, tag));

  const hasSource = Boolean(
    suggestFrom &&
      [suggestFrom.title, suggestFrom.description, suggestFrom.content, suggestFrom.url].some(
        (text) => text?.trim(),
      ),
  );

  function handleSuggest() {
    if (!suggestFrom) return;

    const currentTags = tagsForAi(value);

    startTransition(async () => {
      const result = await generateAutoTags({ ...suggestFrom, currentTags });

      if (!result.success) {

        failureToast(result);

        return;
      }

      const fresh = result.data.tags.filter((tag) => !hasTagInput(value, tag));

      if (fresh.length === 0) {
        toast('No new tags to suggest.');
      }

      setSuggestions(fresh);
    });
  }

  function accept(tag: string) {
    onChange(appendTagInput(value, tag));
    setSuggestions((current) => current.filter((name) => name !== tag));
  }

  function reject(tag: string) {
    setSuggestions((current) => current.filter((name) => name !== tag));
  }

  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label htmlFor={id}>Tags</Label>

        {suggestFrom && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSuggest}
            disabled={isPending || !hasSource}
          >
            <WandSparkles aria-hidden="true" />
            {isPending ? 'Suggesting…' : 'Suggest Tags'}
          </Button>
        )}
      </div>

      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(messages?.length)}
        aria-describedby={hintId}
        placeholder="react, hooks, typescript"
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        Separate tags with commas.
      </p>

      {offered.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Suggested tags">
          {offered.map((tag) => (
            <li key={tag}>
              <Badge variant="outline" className="h-7 gap-1 border-dashed pr-1 pl-2.5">
                <span className="max-w-48 truncate">{tag}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => accept(tag)}
                  aria-label={`Accept tag ${tag}`}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  <Check aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => reject(tag)}
                  aria-label={`Reject tag ${tag}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X aria-hidden="true" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {/* Announces arrival, since focus stays on the button. */}
      <p className="sr-only" aria-live="polite">
        {offered.length > 0
          ? `${offered.length} tag${offered.length === 1 ? '' : 's'} suggested`
          : ''}
      </p>

      <ItemFieldError messages={messages} />
    </div>
  );
}
