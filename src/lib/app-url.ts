/**
 * Absolute base for links that leave the app — an email cannot follow a
 * relative path. Taken from the environment rather than the request's `Host`
 * header, which a caller controls and could point a verification link at
 * another origin.
 *
 * Read at call time, never at module scope, so `next build` cannot bake the
 * build machine's value into the bundle — the same rule `src/lib/features.ts`
 * and `src/lib/rate-limit.ts` follow. The fallback is a development
 * convenience: unset in production, every emailed link points at localhost.
 */
const DEFAULT_BASE_URL = 'http://localhost:3000';

export function absoluteUrl(path: string): string {
  return new URL(path, process.env.APP_URL ?? DEFAULT_BASE_URL).toString();
}
