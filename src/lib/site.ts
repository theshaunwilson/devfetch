/**
 * Facts about the public site, shared by the root metadata and the homepage.
 *
 * `SITE_URL` is the canonical origin used as `metadataBase`, which is what
 * turns the share image's path into the absolute URL link previews require.
 * Fixed rather than read from `APP_URL`: root metadata is evaluated once at
 * build, and `src/lib/app-url.ts` deliberately reads `APP_URL` per request so
 * a build cannot bake in the wrong value. A share card is only ever fetched
 * for the public site, so pointing at it from every environment is correct.
 */
export const SITE_URL = 'https://devfetch.site';

export const SITE_NAME = 'DevFetch';

/** The homepage's title, which is also what a shared link is titled. */
export const SITE_TITLE = 'DevFetch — One place for everything you keep';

export const SITE_DESCRIPTION =
  'DevFetch is a searchable hub for the snippets, prompts, commands, notes, files and links developers scatter across a dozen tools.';
