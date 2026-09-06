import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma 7 generated client
    "src/generated/**",
    // Vitest coverage report
    "coverage/**",
    // Monaco's prebuilt bundle, copied in by scripts/copy-monaco.ts. Flat
    // config does not read .gitignore, and linting 27MB of minified AMD
    // modules exhausts the heap rather than merely wasting time.
    "public/monaco/**",
  ]),
]);

export default eslintConfig;
