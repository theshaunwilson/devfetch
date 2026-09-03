/**
 * The id on the app shell's `<main>`.
 *
 * Shared because two components need to agree on it: `AppShell` puts it on the
 * element, and the item drawer focuses that element when the card it would
 * otherwise return focus to has been deleted.
 */
export const MAIN_CONTENT_ID = 'main-content';
