/**
 * Copies Monaco's prebuilt AMD bundle into public/, so the editor loads from
 * this origin rather than a CDN.
 *
 * `@monaco-editor/react` fetches Monaco at runtime from jsdelivr by default.
 * Nothing else in this app reaches out to a third party at runtime, and a CDN
 * would also mean the editor breaks offline and needs a CSP allowance, so the
 * loader is pointed at /monaco/vs instead — see src/lib/monaco.ts.
 *
 * The alternative is importing `monaco-editor` and letting Next bundle it,
 * which needs explicit web-worker wiring; copying the shipped AMD build needs
 * none, because its own loader resolves workers relative to the same path.
 *
 * public/monaco is generated, not committed: it is gitignored and this script
 * runs from postinstall, so a fresh clone rebuilds it.
 *
 * Run with: npm run monaco:copy
 */
import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Given a path rather than import.meta.url: tsx compiles this file to CJS,
// where import.meta does not exist.
const resolver = createRequire(join(process.cwd(), 'package.json'));

/**
 * The monaco-editor package's own directory.
 *
 * Found by resolving its entry point and walking up to the package.json,
 * rather than hardcoding node_modules/monaco-editor, so a hoisted or
 * pnpm-style layout still finds it. Its `exports` map covers no path ending
 * in package.json, so that file cannot simply be resolved by name.
 */
function monacoPackageRoot(): string {
  let directory = dirname(resolver.resolve('monaco-editor'));

  while (!existsSync(join(directory, 'package.json'))) {
    const parent = dirname(directory);

    if (parent === directory) {
      throw new Error('Could not locate the monaco-editor package directory.');
    }

    directory = parent;
  }

  return directory;
}

async function main() {
  const source = join(monacoPackageRoot(), 'min', 'vs');

  if (!existsSync(join(source, 'loader.js'))) {
    throw new Error(`No Monaco AMD bundle at ${source}.`);
  }
  const destination = join(process.cwd(), 'public', 'monaco', 'vs');

  // Cleared first, so an upgrade cannot leave a previous version's files
  // behind to be picked up by the AMD loader.
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });

  console.log(`Copied the Monaco bundle from ${source} to public/monaco/vs`);
}

main();
