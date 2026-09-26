'use client';

import { ItemFieldError } from '@/components/items/ItemFieldError';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { findLanguageOption, languageSelectOptions } from '@/lib/code-language';

/** Radix Select refuses an empty item value, so "no language" needs a stand-in. */
const PLAIN_TEXT = '__plain-text__';

interface LanguageSelectProps {
  id: string;
  /** The stored text, `''` for none. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  messages?: string[];
}

/**
 * The Language field: a dropdown of the languages Monaco highlights.
 *
 * The code editor reads the same state, so picking a language re-highlights
 * the content straight away rather than on save.
 */
export function LanguageSelect({ id, value, onChange, disabled, messages }: LanguageSelectProps) {
  const options = languageSelectOptions(value);
  // A stored `TypeScript` selects the `typescript` row, but state keeps the
  // stored text until the user picks, so an untouched item saves unchanged.
  const selected = findLanguageOption(value)?.value ?? (value.trim() || PLAIN_TEXT);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Language</Label>
      <Select
        value={selected}
        onValueChange={(next) => onChange(next === PLAIN_TEXT ? '' : next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(messages?.length)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={PLAIN_TEXT}>Plain text</SelectItem>
          <SelectSeparator />
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ItemFieldError messages={messages} />
    </div>
  );
}
