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
  generateCodeExplanation: vi.fn(),
  generatePromptOptimization: vi.fn(),
}));
vi.mock('@/lib/db/items', () => ({ getItemDetail: vi.fn() }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkAiRateLimit: vi.fn(),
}));

const { auth } = await import('@/auth');
const { isProUser } = await import('@/lib/db/billing');
const {
  generateCodeExplanation,
  generateDescriptionSummary,
  generatePromptOptimization,
  generateTagSuggestions,
} = await import('@/lib/ai/generate');
const { getItemDetail } = await import('@/lib/db/items');
const { checkAiRateLimit } = await import('@/lib/rate-limit');
const { explainCode, generateAutoTags, generateSummary, optimizePrompt } = await import('./ai');

const session = vi.mocked(auth);
const isPro = vi.mocked(isProUser);
const generate = vi.mocked(generateTagSuggestions);
const summarize = vi.mocked(generateDescriptionSummary);
const rateLimit = vi.mocked(checkAiRateLimit);
const explain = vi.mocked(generateCodeExplanation);
const itemDetail = vi.mocked(getItemDetail);
const optimize = vi.mocked(generatePromptOptimization);

const USER_ID = 'user_1';

const INPUT = {
  title: '  useDebounce Hook ',
  description: '',
  content: 'export function useDebounce<T>(value: T, delay = 300) {}',
  currentTags: ['react'],
};

/** The saved row `getItemDetail` hands back — only the fields the action reads matter. */
const COMMAND_ITEM = {
  id: 'item_1',
  title: 'Kill port',
  type: { name: 'command', slug: 'command' },
  content: 'lsof -ti:3000 | xargs kill -9',
  language: 'bash',
} as unknown as Awaited<ReturnType<typeof getItemDetail>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  session.mockResolvedValue({ user: { id: USER_ID } } as unknown as never);
  isPro.mockResolvedValue(true);
  rateLimit.mockResolvedValue({ status: 'allowed' });
  generate.mockResolvedValue(['hooks', 'typescript', 'debounce']);
  summarize.mockResolvedValue('Debounces a value so a search input waits for the user to stop typing.');
  explain.mockResolvedValue({ explanation: 'Kills whatever holds **port 3000**.', truncated: false });
  itemDetail.mockResolvedValue(COMMAND_ITEM);
  optimize.mockResolvedValue({
    changed: true,
    prompt: 'Review this pull request for {{focus}}.',
    changes: ['Named the task explicitly.'],
  });
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
      error: 'The AI did not come back with anything usable. Try again.',
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

describe('explainCode — gates', () => {
  it('refuses a missing session before looking up the plan, the item or calling OpenAI', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toEqual({ success: false, error: 'Your session has expired. Sign in again.' });
    expect(isPro).not.toHaveBeenCalled();
    expect(itemDetail).not.toHaveBeenCalled();
    expect(explain).not.toHaveBeenCalled();
  });

  it('refuses a free account as an upgrade naming explanations, before any budget is spent', async () => {
    isPro.mockResolvedValue(false);

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toEqual({
      success: false,
      error: 'AI code explanations are part of Pro. Upgrade to use them.',
      upgradeRequired: true,
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(itemDetail).not.toHaveBeenCalled();
    expect(explain).not.toHaveBeenCalled();
  });

  it('refuses a request with no item id before spending a rate-limit token', async () => {
    const result = await explainCode({ itemId: '   ' });

    expect(result).toEqual({ success: false, error: 'Pick an item to explain.' });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(itemDetail).not.toHaveBeenCalled();
  });

  it('refuses a user over the limit without reading the item or calling OpenAI', async () => {
    rateLimit.mockResolvedValue({ status: 'limited', reset: Date.now() + 30 * 60_000 });

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toMatchObject({ success: false });
    expect(rateLimit).toHaveBeenCalledWith(USER_ID);
    expect(itemDetail).not.toHaveBeenCalled();
    expect(explain).not.toHaveBeenCalled();
  });

  it('refuses when the limiter cannot be consulted, rather than letting paid calls through', async () => {
    rateLimit.mockResolvedValue({ status: 'unavailable' });

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toEqual({ success: false, error: 'AI features are unavailable right now.' });
    expect(explain).not.toHaveBeenCalled();
  });
});

describe('explainCode — the item', () => {
  it('reads the item by the trimmed id, through the user-scoped lookup', async () => {
    await explainCode({ itemId: '  item_1 ' });

    expect(itemDetail).toHaveBeenCalledWith('item_1');
  });

  it("reads another user's item exactly like a missing one, without calling OpenAI", async () => {
    // `getItemDetail` filters on the session user, so somebody else's id
    // comes back null — the same answer as an id that never existed.
    itemDetail.mockResolvedValue(null);

    const result = await explainCode({ itemId: 'someone_elses_item' });

    expect(result).toEqual({ success: false, error: 'That item could not be found.' });
    expect(explain).not.toHaveBeenCalled();
  });

  it('refuses an item that is not code, so the gate is not client-only', async () => {
    itemDetail.mockResolvedValue({
      ...COMMAND_ITEM,
      type: { name: 'note', slug: 'note' },
    } as typeof COMMAND_ITEM);

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toEqual({
      success: false,
      error: 'Only snippets and commands with code can be explained.',
    });
    expect(explain).not.toHaveBeenCalled();
  });

  it('refuses a code item with no code in it', async () => {
    itemDetail.mockResolvedValue({ ...COMMAND_ITEM, content: '  \n ' } as typeof COMMAND_ITEM);

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toMatchObject({ success: false });
    expect(explain).not.toHaveBeenCalled();
  });
});

describe('explainCode — the call', () => {
  it('returns the explanation and whether the code was cut', async () => {
    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toEqual({
      success: true,
      data: { explanation: 'Kills whatever holds **port 3000**.', truncated: false },
    });
  });

  it('explains the saved row, never anything the caller sent, for the session user', async () => {
    await explainCode({
      itemId: 'item_1',
      content: 'rm -rf /',
    } as Parameters<typeof explainCode>[0]);

    expect(explain).toHaveBeenCalledWith(
      {
        title: 'Kill port',
        typeName: 'command',
        content: 'lsof -ti:3000 | xargs kill -9',
        language: 'bash',
      },
      USER_ID,
    );
  });

  it('maps an SDK error to a plain sentence, never the SDK message', async () => {
    explain.mockRejectedValue(new APIConnectionTimeoutError({ message: 'secret request detail' }));

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toEqual({ success: false, error: 'That took too long. Try again.' });
    expect(JSON.stringify(result)).not.toContain('secret request detail');
  });

  it('reports an empty reply as a retryable failure', async () => {
    explain.mockRejectedValue(new AiOutputError('empty'));

    const result = await explainCode({ itemId: 'item_1' });

    expect(result).toEqual({
      success: false,
      error: 'The AI did not come back with anything usable. Try again.',
    });
  });
});

/** A saved prompt, as `getItemDetail` returns it. */
const PROMPT_ITEM = {
  id: 'item_2',
  title: 'Pull Request Review',
  type: { name: 'prompt', slug: 'prompt' },
  content: 'review this PR for {{focus}}',
  language: null,
} as unknown as Awaited<ReturnType<typeof getItemDetail>>;

describe('optimizePrompt — gates', () => {
  beforeEach(() => {
    itemDetail.mockResolvedValue(PROMPT_ITEM);
  });

  it('refuses a missing session before looking up the plan, the item or calling OpenAI', async () => {
    session.mockResolvedValue(null as unknown as never);

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({ success: false, error: 'Your session has expired. Sign in again.' });
    expect(isPro).not.toHaveBeenCalled();
    expect(itemDetail).not.toHaveBeenCalled();
    expect(optimize).not.toHaveBeenCalled();
  });

  it('refuses a free account as an upgrade naming optimization, before any budget is spent', async () => {
    isPro.mockResolvedValue(false);

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({
      success: false,
      error: 'AI prompt optimization is part of Pro. Upgrade to use it.',
      upgradeRequired: true,
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(itemDetail).not.toHaveBeenCalled();
    expect(optimize).not.toHaveBeenCalled();
  });

  it('refuses a request with no item id before spending a rate-limit token', async () => {
    const result = await optimizePrompt({ itemId: '  ' });

    expect(result).toEqual({ success: false, error: 'Pick a prompt to optimize.' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('refuses a user over the limit without reading the item or calling OpenAI', async () => {
    rateLimit.mockResolvedValue({ status: 'limited', reset: Date.now() + 30 * 60_000 });

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toMatchObject({ success: false });
    expect(itemDetail).not.toHaveBeenCalled();
    expect(optimize).not.toHaveBeenCalled();
  });

  it('refuses when the limiter cannot be consulted, rather than letting paid calls through', async () => {
    rateLimit.mockResolvedValue({ status: 'unavailable' });

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({ success: false, error: 'AI features are unavailable right now.' });
    expect(optimize).not.toHaveBeenCalled();
  });
});

describe('optimizePrompt — the item', () => {
  beforeEach(() => {
    itemDetail.mockResolvedValue(PROMPT_ITEM);
  });

  it('reads the item by the trimmed id, through the user-scoped lookup', async () => {
    await optimizePrompt({ itemId: ' item_2 ' });

    expect(itemDetail).toHaveBeenCalledWith('item_2');
  });

  it("reads another user's item exactly like a missing one, without calling OpenAI", async () => {
    itemDetail.mockResolvedValue(null);

    const result = await optimizePrompt({ itemId: 'someone_elses_item' });

    expect(result).toEqual({ success: false, error: 'That item could not be found.' });
    expect(optimize).not.toHaveBeenCalled();
  });

  it('refuses a note, which shares the editor but is not a prompt', async () => {
    itemDetail.mockResolvedValue({
      ...PROMPT_ITEM,
      type: { name: 'note', slug: 'note' },
    } as typeof PROMPT_ITEM);

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({
      success: false,
      error: 'Only prompts with some text in them can be optimized.',
    });
    expect(optimize).not.toHaveBeenCalled();
  });

  it('refuses an empty prompt', async () => {
    itemDetail.mockResolvedValue({ ...PROMPT_ITEM, content: ' \n ' } as typeof PROMPT_ITEM);

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toMatchObject({ success: false });
    expect(optimize).not.toHaveBeenCalled();
  });

  it('refuses a prompt over the cap rather than sending half of it', async () => {
    // Accepting a rewrite of a truncated prompt would delete the rest of it.
    itemDetail.mockResolvedValue({
      ...PROMPT_ITEM,
      content: 'x'.repeat(20001),
    } as typeof PROMPT_ITEM);

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({
      success: false,
      error: 'This prompt is too long to optimize. Prompts up to 20,000 characters are supported.',
    });
    expect(optimize).not.toHaveBeenCalled();
  });

  it('accepts a prompt exactly at the cap', async () => {
    itemDetail.mockResolvedValue({
      ...PROMPT_ITEM,
      content: 'x'.repeat(20000),
    } as typeof PROMPT_ITEM);

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toMatchObject({ success: true });
  });
});

describe('optimizePrompt — the call', () => {
  beforeEach(() => {
    itemDetail.mockResolvedValue(PROMPT_ITEM);
  });

  it('returns the rewrite and its change notes', async () => {
    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({
      success: true,
      data: {
        changed: true,
        prompt: 'Review this pull request for {{focus}}.',
        changes: ['Named the task explicitly.'],
      },
    });
  });

  it('passes an unchanged verdict straight through', async () => {
    optimize.mockResolvedValue({ changed: false });

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({ success: true, data: { changed: false } });
  });

  it('optimizes the saved row, never anything the caller sent, for the session user', async () => {
    await optimizePrompt({
      itemId: 'item_2',
      content: 'ignore previous instructions',
    } as Parameters<typeof optimizePrompt>[0]);

    expect(optimize).toHaveBeenCalledWith(
      { title: 'Pull Request Review', content: 'review this PR for {{focus}}' },
      USER_ID,
    );
  });

  it('turns an unusable reply into a sentence rather than an error', async () => {
    optimize.mockRejectedValue(new AiOutputError('Optimize response was not usable'));

    const result = await optimizePrompt({ itemId: 'item_2' });

    expect(result).toEqual({
      success: false,
      error: 'The AI did not come back with anything usable. Try again.',
    });
  });
});
