/**
 * The lazy client. As with `src/lib/stripe.test.ts`, the property under test
 * is *when* the key is read: at call time, never at import, so `next build`
 * does not depend on the build machine holding it. Constructing the SDK issues
 * no request, so nothing here reaches OpenAI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fresh registry per test, so the module-level client cache starts empty. */
async function loadModule() {
  vi.resetModules();

  return import('./openai');
}

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getOpenAI', () => {
  it('throws when the key is unset', async () => {
    const { getOpenAI } = await loadModule();

    expect(() => getOpenAI()).toThrow('OPENAI_API_KEY is not set');
  });

  it('throws for a key that is only whitespace', async () => {
    vi.stubEnv('OPENAI_API_KEY', '   ');

    const { getOpenAI } = await loadModule();

    expect(() => getOpenAI()).toThrow('OPENAI_API_KEY is not set');
  });

  it('reads the key at call time, so importing without it is safe', async () => {
    const { getOpenAI } = await loadModule();

    expect(() => getOpenAI()).toThrow();

    vi.stubEnv('OPENAI_API_KEY', 'sk-test');

    expect(getOpenAI()).toBeDefined();
  });

  it('reuses one client', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');

    const { getOpenAI } = await loadModule();

    expect(getOpenAI()).toBe(getOpenAI());
  });

  it('gives up long before the SDK default of 10 minutes', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');

    const { getOpenAI } = await loadModule();

    expect(getOpenAI().timeout).toBeLessThanOrEqual(60_000);
  });
});

describe('AI_MODEL', () => {
  it('is gpt-5-nano', async () => {
    const { AI_MODEL } = await loadModule();

    expect(AI_MODEL).toBe('gpt-5-nano');
  });
});
