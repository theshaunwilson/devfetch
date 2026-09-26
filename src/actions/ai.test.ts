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
vi.mock('@/lib/ai/generate', () => ({
  generateTagSuggestions: vi.fn(),
  generateDescriptionSummary: vi.fn(),
}));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkAiRateLimit: vi.fn(),
}));

const { auth } = await import('@/auth');
const { isProUser } = await import('@/lib/db/billing');
const { generateDescriptionSummary, generateTagSuggestions } = await import('@/lib/ai/generate');
const { checkAiRateLimit } = await import('@/lib/rate-limit');
const { generateAutoTags, generateSummary } = await import('./ai');

const session = vi.mocked(auth);
const isPro = vi.mocked(isProUser);
const generate = vi.mocked(generateTagSuggestions);
const summarize = vi.mocked(generateDescriptionSummary);
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
  summarize.mockResolvedValue('Debounces a value so a search input waits for the user to stop typing.');
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

const SUMMARY_INPUT = {
  title: '  useDebounce Hook ',
  typeName: 'snippet',
  content: 'export function useDebounce<T>(value: T, delay = 300) {}',
  language: 'typescript',
  url: undefined,
  fileName: undefined,
  tags: ['react'],
};

describe('generateSummary — gates', () => {
  it('refuses a missing session before looking up the plan or calling OpenAI', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await generateSummary(SUMMARY_INPUT);

    expect(result).toEqual({
      success: false,
      error: 'Your session has expired. Sign in again.',
    });
    expect(isPro).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it('refuses a free account as an upgrade naming descriptions, before any budget is spent', async () => {
    isPro.mockResolvedValue(false);

    const result = await generateSummary(SUMMARY_INPUT);

    expect(result).toEqual({
      success: false,
      error: 'AI descriptions are part of Pro. Upgrade to use them.',
      upgradeRequired: true,
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it('refuses an item with nothing to describe before spending a rate-limit token', async () => {
    const result = await generateSummary({
      title: '  ',
      typeName: 'note',
      content: ' ',
      url: '',
      fileName: '',
      tags: ['react'],
    });

    expect(result).toEqual({ success: false, error: 'Add a title or some content first.' });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it('accepts a file item described by its name alone', async () => {
    const result = await generateSummary({
      title: '',
      typeName: 'file',
      fileName: 'docker-compose.yml',
      tags: [],
    });

    expect(result.success).toBe(true);
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({ title: '', fileName: 'docker-compose.yml' }),
      USER_ID,
    );
  });

  it('refuses a request with no type name', async () => {
    const result = await generateSummary({ ...SUMMARY_INPUT, typeName: '  ' });

    expect(result).toEqual({ success: false, error: 'Pick a type first.' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('refuses over-long input with the field rule, without the upgrade flag', async () => {
    const result = await generateSummary({ ...SUMMARY_INPUT, fileName: 'x'.repeat(256) });

    expect(result).toEqual({ success: false, error: 'File name must be at most 255 characters' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('shares the AI rate limit, keyed on the session user', async () => {
    await generateSummary(SUMMARY_INPUT);

    expect(rateLimit).toHaveBeenCalledWith(USER_ID);
  });

  it('refuses a user over the limit, without calling OpenAI', async () => {
    rateLimit.mockResolvedValue({ status: 'limited', reset: Date.now() + 30 * 60_000 });

    const result = await generateSummary(SUMMARY_INPUT);

    expect(result).toEqual({
      success: false,
      error: 'You have used your AI requests for now. Try again in 30 minutes.',
    });
    expect(summarize).not.toHaveBeenCalled();
  });

  it('refuses when the limiter cannot be consulted, rather than letting paid calls through', async () => {
    rateLimit.mockResolvedValue({ status: 'unavailable' });

    const result = await generateSummary(SUMMARY_INPUT);

    expect(result).toEqual({ success: false, error: 'AI features are unavailable right now.' });
    expect(summarize).not.toHaveBeenCalled();
  });
});

describe('generateSummary — the call', () => {
  it('returns the summary', async () => {
    const result = await generateSummary(SUMMARY_INPUT);

    expect(result).toEqual({
      success: true,
      data: {
        summary: 'Debounces a value so a search input waits for the user to stop typing.',
      },
    });
  });

  it('sends the parsed input — trimmed, with blanks as null — and the session user', async () => {
    await generateSummary({ ...SUMMARY_INPUT, url: '  ' });

    expect(summarize).toHaveBeenCalledWith(
      {
        title: 'useDebounce Hook',
        typeName: 'snippet',
        content: SUMMARY_INPUT.content,
        language: 'typescript',
        url: null,
        tags: ['react'],
      },
      USER_ID,
    );
  });

  it('never passes a description through, even when one is sent', async () => {
    await generateSummary({
      ...SUMMARY_INPUT,
      description: 'an old description',
    } as Parameters<typeof generateSummary>[0]);

    expect(summarize.mock.calls[0][0]).not.toHaveProperty('description');
  });

  it('maps an SDK error to a plain sentence, never the SDK message', async () => {
    summarize.mockRejectedValue(
      new APIConnectionTimeoutError({ message: 'secret request detail' }),
    );

    const result = await generateSummary(SUMMARY_INPUT);

    expect(result).toEqual({ success: false, error: 'That took too long. Try again.' });
    expect(JSON.stringify(result)).not.toContain('secret request detail');
  });

  it('reports an empty reply as a retryable failure', async () => {
    summarize.mockRejectedValue(new AiOutputError('empty'));

    const result = await generateSummary(SUMMARY_INPUT);

    expect(result).toMatchObject({ success: false });
    expect(console.warn).toHaveBeenCalled();
  });
});
