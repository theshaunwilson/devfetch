import { z } from 'zod';

/**
 * Trims first, then checks — chained the other way a value would be measured
 * with its padding still on, and `"   "` would pass a `min(1)`. Zod runs checks
 * before transforms within one schema, so the order has to be forced with a
 * pipe rather than a chain.
 */
export function trimmed() {
  return z.string().transform((value) => value.trim());
}

/**
 * An optional free-text field. Blank means "cleared", so it is stored as NULL
 * rather than an empty string — the schema treats both the same way, and every
 * consumer already renders `null` as absent.
 *
 * Omitted entirely is different from blank: the field is then left untouched,
 * which is how a type-specific input that was never shown avoids wiping the
 * column behind it.
 */
export function optionalText(max: number, label: string) {
  return trimmed()
    .pipe(z.string().max(max, `${label} must be at most ${max} characters`))
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}

/**
 * A required free-text field: present, non-blank once trimmed, and bounded.
 */
export function requiredText(max: number, label: string) {
  return trimmed().pipe(
    z
      .string()
      .min(1, `${label} is required`)
      .max(max, `${label} must be at most ${max} characters`),
  );
}
