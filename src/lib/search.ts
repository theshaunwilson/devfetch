import type { DashboardItem } from '@/types/item';
import type { CollectionOption } from '@/types/collection';

/**
 * How much of an item's body the palette carries and searches.
 *
 * The column holds up to `CONTENT_MAX_LENGTH` (100,000) characters, and the
 * whole index ships in the shell's payload on every request, so the body is
 * truncated in SQL rather than fetched in full — see `getSearchItems`. The
 * trade is that a match deeper than this into a long snippet is not found.
 */
export const SEARCH_PREVIEW_LENGTH = 160;

/**
 * Ceiling on how many items the palette pre-fetches, most recently updated
 * first.
 *
 * The index is pre-fetched on app load, so every item in it costs payload on
 * every navigation. The Free tier stops at 50 items; this leaves Pro accounts
 * a wide margin while keeping both the payload and the rendered row count
 * bounded.
 */
export const SEARCH_ITEM_LIMIT = 500;

/**
 * The score a row must reach to be shown at all.
 *
 * cmdk scores with `command-score`, which matches a query as a *subsequence*:
 * every string holding t…e…s…t in order scores above zero, so "test" matched 21
 * of 22 seeded items and the palette looked like it was ignoring the query.
 *
 * Measured against the seeded data, a real match and a scattered one are two
 * orders of magnitude apart — for "test", "docker" and "npm" the genuine
 * matches scored 0.79 to 1.00 and the noise never passed 0.17 — so the cut sits
 * in the middle of a wide empty band rather than on a tuned number.
 *
 * The cost is real and worth stating: a genuine typo ("dockrfile" for
 * Dockerfile) scores 0.15, inside the same band as the noise, so no threshold
 * can keep one and drop the other. Prefixes ("debounc"), in-word abbreviations
 * ("usedeb") and multi-word queries ("kill port") all score well above the cut
 * and still work.
 */
export const SEARCH_SCORE_THRESHOLD = 0.5;

/** How one keyword is scored against the query. `cmdk`'s `defaultFilter`, in practice. */
export type KeywordScorer = (value: string, search: string) => number;

/**
 * How well a row matches, scored per keyword rather than across all of them.
 *
 * The best single field wins. Handing cmdk one joined string instead lets a
 * query match by taking a letter from the title, one from a tag and the rest
 * from the body — which is most of where the noise came from: per field,
 * "test" goes from 21 matches to 5, and "docker" from 11 to 3.
 *
 * Returns 0 below the threshold, which is what cmdk reads as "do not show it".
 */
export function scoreKeywords(
  keywords: string[],
  search: string,
  score: KeywordScorer,
): number {
  let best = 0;

  for (const keyword of keywords) {
    const keywordScore = score(keyword, search);

    if (keywordScore > best) best = keywordScore;
  }

  return best >= SEARCH_SCORE_THRESHOLD ? best : 0;
}

/** Keydown fields the shortcut test reads. Not a full `KeyboardEvent`, so it can be tested. */
export interface SearchShortcutEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
}

/**
 * Whether a keydown is the palette's Cmd+K / Ctrl+K shortcut.
 *
 * `defaultPrevented` is part of the test rather than an afterthought: the
 * listener sits on the document, so it sees keys another handler has already
 * claimed — Monaco binds Cmd+K chords of its own, and an editor that has
 * handled the key must keep it.
 */
export function isSearchShortcut(event: SearchShortcutEvent): boolean {
  if (event.defaultPrevented) return false;
  if (!event.metaKey && !event.ctrlKey) return false;

  return event.key.toLowerCase() === 'k';
}

/**
 * One line of text out of a stored body: newlines and runs of whitespace
 * collapse to single spaces, so a code snippet reads as a subtitle rather than
 * wrapping its indentation into the row.
 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * What an item is matched on. cmdk scores the item's `value`, which has to be
 * unique and is therefore the item's id — so the text worth searching is
 * handed over separately as keywords.
 *
 * Type name rather than slug: the two are the same word for the built-ins, and
 * repeating it would weight the type above the title.
 */
export function buildItemKeywords(item: DashboardItem & { contentPreview: string | null }): string[] {
  return [
    item.title,
    item.type.name,
    ...item.tags,
    item.description ?? '',
    item.fileName ?? '',
    item.contentPreview ? collapseWhitespace(item.contentPreview) : '',
  ]
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** What a collection is matched on. Its name is all it has to offer. */
export function buildCollectionKeywords(collection: CollectionOption): string[] {
  return [collection.name.trim()].filter((part) => part.length > 0);
}
