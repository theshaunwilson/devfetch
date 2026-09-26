// Fails the build if a client component imports this. The key must never be
// reachable from the browser bundle.
import 'server-only';

import OpenAI from 'openai';

/**
 * The one model every AI feature runs on. Named once so a model change is one
 * line, and so a test can assert each call uses it.
 */
export const AI_MODEL = 'gpt-5-nano';

/**
 * The OpenAI client, built on first use and reused for the life of the
 * process — lazy for the reason `getStripe()` is. `new OpenAI()` with no key
 * throws at construction, so a module-level client would break every
 * `next build` that runs without it.
 */
let client: OpenAI | undefined;

/**
 * The OpenAI client, or a throw when the key is missing.
 *
 * Throws like `getStripe()` and unlike `src/lib/rate-limit.ts`: with no key
 * there is no API to call, and pretending otherwise would fail every request
 * silently. The key is passed explicitly rather than left to the SDK's own env
 * lookup, so the trim and the throw belong to us.
 */
export function getOpenAI(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  client = new OpenAI({
    apiKey,
    // The SDK default is 10 minutes. Somebody is waiting on a button, so give
    // up long before that.
    timeout: 30_000,
    // The SDK default, stated so nobody "fixes" it. Retries already cover
    // 408/409/429/5xx and dropped connections with backoff; more only makes a
    // failing request take longer to report.
    maxRetries: 2,
  });

  return client;
}
