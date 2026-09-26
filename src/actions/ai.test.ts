/**
 * `generateAutoTags` is a public endpoint that spends money, so what is pinned
 * here is the order it refuses things in — session, then plan, then input,
 * then the rate limit — and that nothing costs anything until every gate has
 * passed: a refused request never reaches OpenAI, and a malformed one never
 * spends a rate-limit token.
 *
 * Same pattern as `src/actions/billing.test.ts`: mock the module boundary —
 * `@/auth`, `@/lib/db/billing`, `@/lib/ai/generate` and the Upstash check —
 * and leave the Zod schema, the error mapping and the limit message real, so
 * the action is tested against the rules production runs.
 */
import { APIConnectionTimeoutError, RateLimitError } from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiOutputError } from '@/lib/ai/errors';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db/billing', () => ({ isProUser: vi.fn() }));
vi.mock('@/lib/ai/generate', () => ({ generateTagSuggestions: vi.fn() }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkAiRateLimit: vi.fn(),
}));

const { auth } = await import('@/auth');
const { isProUser } = await import('@/lib/db/billing');
const { generateTagSuggestions } = await import('@/lib/ai/generate');
const { checkAiRateLimit } = await import('@/lib/rate-limit');
const { generateAutoTags } = await import('./ai');

const session = vi.mocked(auth);
const isPro = vi.mocked(isProUser);
const generate = vi.mocked(generateTagSuggestions);
const rateLimit = vi.mocked(checkAiRateLimit);

const USER_ID = 'user_1';

const INPUT = {
  title: '  useDebounce Hook ',
  description: '',
  content: 'export function useDebounce<T>(value: T, delay = 300) {}',
  currentTags: ['react'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  session.mockResolvedValue({ user: { id: USER_ID } } as unknown as never);
  isPro.mockResolvedValue(true);
  rateLimit.mockResolvedValue({ status: 'allowed' });
  generate.mockResolvedValue(['hooks', 'typescript', 'debounce']);
});

describe('generateAutoTags — gates', () => {
  it('refuses a missing session before looking up the plan or calling OpenAI', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await generateAutoTags(INPUT);

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
    expect(isPro).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuses a free account as an upgrade, without spending a rate-limit token or calling OpenAI', async () => {
    isPro.mockResolvedValue(false);

    const result = await generateAutoTags(INPUT);

    expect(result).toMatchObject({ success: false, upgradeRequired: true });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuses input with nothing to tag before spending a rate-limit token', async () => {
    const result = await generateAutoTags({
      title: '   ',
      description: '',
      content: '  ',
      url: '',
      currentTags: [],
    });

    expect(result).toEqual({ success: false, error: 'Add a title or some content first.' });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuses over-long input with the field rule, not a generic failure', async () => {
    const result = await generateAutoTags({ ...INPUT, title: 'x'.repeat(201) });

    expect(result).toEqual({ success: false, error: 'Title must be at most 200 characters' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('refuses a validation failure without the upgrade flag', async () => {
    const result = await generateAutoTags({ ...INPUT, currentTags: ['x'.repeat(51)] });

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('upgradeRequired');
  });

  it('keys the rate limit on the session user, never on anything the caller sent', async () => {
    await generateAutoTags(INPUT);

    expect(rateLimit).toHaveBeenCalledWith(USER_ID);
  });

  it('refuses a user over the limit with a wait, without calling OpenAI', async () => {
    rateLimit.mockResolvedValue({ status: 'limited', reset: Date.now() + 30 * 60_000 });

    const result = await generateAutoTags(INPUT);

    expect(result).toEqual({
      success: false,
      error: 'You have used your AI requests for now. Try again in 30 minutes.',
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuses when the limiter cannot be consulted, rather than letting paid calls through', async () => {
    rateLimit.mockResolvedValue({ status: 'unavailable' });

    const result = await generateAutoTags(INPUT);

    expect(result).toEqual({ success: false, error: 'AI features are unavailable right now.' });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('generateAutoTags — the call', () => {
  it('returns the suggestions', async () => {
    const result = await generateAutoTags(INPUT);

    expect(result).toEqual({
      success: true,
      data: { tags: ['hooks', 'typescript', 'debounce'] },
    });
  });

  it('sends the parsed input — trimmed, with blanks as null — and the session user', async () => {
    await generateAutoTags(INPUT);

    expect(generate).toHaveBeenCalledWith(
      {
        title: 'useDebounce Hook',
        description: null,
        content: INPUT.content,
        currentTags: ['react'],
      },
      USER_ID,
    );
  });

  it('maps an SDK error to a plain sentence, never the SDK message', async () => {
    generate.mockRejectedValue(new APIConnectionTimeoutError({ message: 'secret request detail' }));

    const result = await generateAutoTags(INPUT);

    expect(result).toEqual({ success: false, error: 'That took too long. Try again.' });
    expect(JSON.stringify(result)).not.toContain('secret request detail');
  });

  it('treats an exhausted OpenAI budget as unavailable and logs it loudly', async () => {
    generate.mockRejectedValue(
      new RateLimitError(429, { code: 'insufficient_quota' }, 'quota', new Headers()),
    );

    const result = await generateAutoTags(INPUT);

    expect(result).toEqual({ success: false, error: 'AI features are unavailable right now.' });
    expect(console.error).toHaveBeenCalled();
  });

  it('reports an unusable reply as a retryable failure', async () => {
    generate.mockRejectedValue(new AiOutputError('incomplete'));

    const result = await generateAutoTags(INPUT);

    expect(result).toEqual({
      success: false,
      error: 'The AI could not come up with suggestions. Try again.',
    });
    expect(console.warn).toHaveBeenCalled();
  });
});
