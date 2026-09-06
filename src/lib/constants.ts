/**
 * The id on the app shell's `<main>`.
 *
 * Shared because two components need to agree on it: `AppShell` puts it on the
 * element, and the item drawer focuses that element when the card it would
 * otherwise return focus to has been deleted.
 */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * The tallest either content editor grows before it scrolls instead.
 *
 * Shared because the code editor and the markdown editor sit next to each
 * other in the same drawer, and a ceiling that differed between them would
 * show as one panel outgrowing the other.
 */
export const EDITOR_MAX_HEIGHT = 400;
