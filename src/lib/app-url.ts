/**
 * Absolute base for links that leave the app — an email cannot follow a
 * relative path. Taken from the environment rather than the request's `Host`
 * header, which a caller controls and could point a verification link at
 * another origin.
 */
const BASE_URL = process.env.APP_URL ?? 'http://localhost:3000';

export function absoluteUrl(path: string): string {
  return new URL(path, BASE_URL).toString();
}
