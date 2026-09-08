/**
 * Validation messages for one item field.
 *
 * Deliberately not merged with `@/components/auth/FieldError`, which shows
 * only the first message at `text-xs` and wires an `id` to its input: the two
 * differ in behaviour, and collapsing them would mean picking which behaviour
 * wins on both sides.
 */
export function ItemFieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return <p className="text-sm text-destructive">{messages.join('. ')}</p>;
}
