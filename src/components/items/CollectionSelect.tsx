'use client';

import { ChevronDown } from 'lucide-react';

import { ItemFieldError } from '@/components/items/ItemFieldError';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import type { CollectionOption } from '@/types/collection';

interface CollectionSelectProps {
  /** The trigger's id, so the label points at it. */
  id: string;
  /** Every collection the user owns. Empty for an account with none yet. */
  options: CollectionOption[];
  /** The ids currently ticked. */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  messages?: string[];
}

/**
 * The collections an item is filed in, as a dropdown of checkboxes.
 *
 * A `DropdownMenu` of `DropdownMenuCheckboxItem`s rather than a new
 * multi-select: both already ship in `@/components/ui/dropdown-menu`, so this
 * needs no `shadcn add`, and because the list is an overlay the form does not
 * grow by a row per collection — which matters most in the create dialog, whose
 * height is capped and has already been clipped once.
 *
 * `onSelect` is prevented on every item, or the menu would close after the first
 * tick and filing an item in three collections would take three trips.
 */
export function CollectionSelect({
  id,
  options,
  value,
  onChange,
  disabled,
  messages,
}: CollectionSelectProps) {
  // In the options' own order — alphabetical, from the query — so the trigger
  // reads the same whichever order they were ticked in.
  const selected = options.filter((option) => value.includes(option.id));

  function toggle(optionId: string) {
    onChange(
      value.includes(optionId) ? value.filter((id) => id !== optionId) : [...value, optionId],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={options.length > 0 ? id : undefined}>Collections</Label>

      {options.length === 0 ? (
        // A hint rather than a disabled control: there is nothing to pick, and
        // an empty dropdown that opens onto nothing is worse than a sentence.
        <p className="text-xs text-muted-foreground">
          No collections yet — create one from the top bar.
        </p>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id={id}
              // Explicit, because this trigger sits inside a form and an
              // untyped button submits it.
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={Boolean(messages?.length)}
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selected.length > 0 ? (
                  selected.map((option) => option.name).join(', ')
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </span>
              <ChevronDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>

          {/* Width and max height come from the content's own defaults: it
              matches the trigger and scrolls once the list outgrows the
              viewport. */}
          <DropdownMenuContent>
            {options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={value.includes(option.id)}
                onCheckedChange={() => toggle(option.id)}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="truncate">{option.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ItemFieldError messages={messages} />
    </div>
  );
}
