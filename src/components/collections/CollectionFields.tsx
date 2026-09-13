'use client';

import { ItemFieldError } from '@/components/items/ItemFieldError';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CollectionFieldsProps {
  /**
   * Distinguishes the element ids, since a create dialog and an edit dialog can
   * both be mounted on one page — the same reason `ItemTextField` takes one.
   */
  idPrefix: string;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  fieldErrors: Record<string, string[]>;
}

/**
 * The two fields a collection has, shared by the create and edit dialogs.
 *
 * Creating and editing write the same metadata through the same schema, so the
 * inputs, their error wiring and their ceilings are one component rather than
 * two copies that could drift apart. What differs between the two — what the
 * submit does and what the buttons say — stays with each form.
 */
export function CollectionFields({
  idPrefix,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  fieldErrors,
}: CollectionFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          aria-invalid={Boolean(fieldErrors.name)}
          placeholder="React Patterns"
          autoFocus
          required
        />
        <ItemFieldError messages={fieldErrors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          aria-invalid={Boolean(fieldErrors.description)}
          rows={3}
        />
        <ItemFieldError messages={fieldErrors.description} />
      </div>
    </>
  );
}
