'use client';

import { ItemFieldError } from '@/components/items/ItemFieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ItemTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'url';
  placeholder?: string;
  required?: boolean;
  /** Shown under the input, above any error — the tags separator note. */
  hint?: string;
  messages?: string[];
}

/** One labelled single-line item field: URL or Tags. */
export function ItemTextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  hint,
  messages,
}: ItemTextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(messages?.length)}
        placeholder={placeholder}
        required={required}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <ItemFieldError messages={messages} />
    </div>
  );
}
