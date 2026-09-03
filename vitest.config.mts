import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path in tsconfig.json. Rollup matches a string
      // alias on `id === find` or `id.startsWith(find + '/')`, so scoped
      // packages like `@upstash/redis` are untouched.
      '@': fromRoot('./src'),
      'server-only': fromRoot('./test/stubs/server-only.ts'),
    },
  },
  test: {
    // Nothing under test renders, so there is no jsdom and no React plugin.
    environment: 'node',
    /**
     * `.ts` and never `.tsx` — this is what keeps the suite to server actions
     * and utilities. A component test needs JSX, so it needs a `.tsx` file,
     * so it is not collected. The scope is enforced by the glob rather than
     * left as a convention to remember.
     */
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        /**
         * `next-auth` imports `next/server` with no file extension, and the
         * `next` package ships no `exports` map — so Node's native ESM
         * resolution cannot find it and the externalized copy fails to load.
         * Inlining hands the module to Vite, whose resolver adds the
         * extension. Needed by any test that imports a server action, since
         * those narrow on `AuthError`.
         */
        inline: ['next-auth'],
      },
    },
    coverage: {
      provider: 'v8',
      // The testable surface only. Components are verified in the browser, so
      // counting them here would report a number nobody intends to move.
      include: ['src/actions/**', 'src/lib/**'],
      reporter: ['text', 'html'],
    },
  },
});
