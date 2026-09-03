/**
 * Stands in for the `server-only` package under Vitest.
 *
 * The real package's `exports` map resolves to an empty module only under the
 * `react-server` condition, which Next sets and Vitest does not. Without this
 * alias the default entry point wins, and its entire body is a `throw` — so
 * importing `src/lib/rate-limit.ts` or any `src/lib/db/*` module in a test
 * would fail before a single assertion ran.
 *
 * Aliased in `vitest.config.ts`. The alternative — `resolve.conditions:
 * ['react-server']` — would fix this too, but it flips resolution for React
 * and Next as well; this touches one package and nothing else.
 */
export {};
