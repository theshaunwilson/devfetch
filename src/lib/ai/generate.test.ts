/**
 * The one module that calls OpenAI. `@/lib/openai` is mocked so nothing
 * reaches the network; what is pinned is the request that would be sent —
 * the model, the Responses API with `json_object`, and the privacy settings —
 * and that a reply which came back but holds nothing usable is an error
 * rather than an empty success.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTO_TAG_CONTENT_MAX_LENGTH } from './auto-tags';
import { AiOutputError } from './errors';
import { SUMMARY_CONTENT_MAX_LENGTH } from './summary';

vi.mock('@/lib/openai', () => ({ AI_MODEL: 'gpt-5-nano', getOpenAI: vi.fn() }));

const { getOpenAI } = await import('@/lib/openai');
const { generateDescriptionSummary, generateTagSuggestions, safetyIdentifier } = await import(
  './generate'
);

const create = vi.fn();

const USER_ID = 'user_1';
const INPUT = { title: 'useDebounce Hook', content: 'const x = 1;', currentTags: ['react'] };

function reply(output_text: string, status = 'completed', reason?: string) {
  return {
    output_text,
    status,
    incomplete_details: reason ? { reason } : null,
    usage: {},
    _request_id: 'req_1',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.mocked(getOpenAI).mockReturnValue({ responses: { create } } as unknown as never);
  create.mockResolvedValue(reply('{"tags": ["Hooks", "#TypeScript", "react"]}'));
});

describe('safetyIdentifier', () => {
  it('is a 64-character hex digest, never the raw id', () => {
    const id = safetyIdentifier(USER_ID);

    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toContain(USER_ID);
  });

  it('is stable per user and different between users', () => {
    expect(safetyIdentifier(USER_ID)).toBe(safetyIdentifier(USER_ID));
    expect(safetyIdentifier(USER_ID)).not.toBe(safetyIdentifier('user_2'));
  });
});

describe('generateTagSuggestions', () => {
  it('calls the Responses API with the model, json_object output and no stored response', async () => {
    await generateTagSuggestions(INPUT, USER_ID);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-nano',
        text: expect.objectContaining({ format: { type: 'json_object' } }),
        store: false,
        safety_identifier: safetyIdentifier(USER_ID),
        max_output_tokens: expect.any(Number),
      }),
    );
  });

  it('sends the instructions separately from the item', async () => {
    await generateTagSuggestions(INPUT, USER_ID);

    const [params] = create.mock.calls[0];

    expect(params.instructions).toMatch(/tags/);
    expect(params.input).toContain('Title: useDebounce Hook');
    expect(params.input.toLowerCase()).toContain('json');
    expect(params).not.toHaveProperty('messages');
  });

  it('sends truncated content', async () => {
    const content = 'x'.repeat(AUTO_TAG_CONTENT_MAX_LENGTH * 3);

    await generateTagSuggestions({ ...INPUT, content }, USER_ID);

    const [params] = create.mock.calls[0];

    expect(params.input.length).toBeLessThan(AUTO_TAG_CONTENT_MAX_LENGTH + 200);
  });

  it('returns normalized tags, minus the ones the item already has', async () => {
    await expect(generateTagSuggestions(INPUT, USER_ID)).resolves.toEqual(['hooks', 'typescript']);
  });

  it('accepts a bare array reply', async () => {
    create.mockResolvedValue(reply('["Docker", "compose"]'));

    await expect(generateTagSuggestions(INPUT, USER_ID)).resolves.toEqual(['docker', 'compose']);
  });

  it('returns an empty list, not an error, when every suggestion was a duplicate', async () => {
    create.mockResolvedValue(reply('{"tags": ["React"]}'));

    await expect(generateTagSuggestions(INPUT, USER_ID)).resolves.toEqual([]);
  });

  it('throws for an incomplete reply even when its text happens to parse', async () => {
    // Valid JSON on purpose: truncated JSON would fail to parse anyway, and
    // then this test could not tell whether the status is checked at all.
    create.mockResolvedValue(reply('{"tags": ["docker"]}', 'incomplete', 'content_filter'));

    await expect(generateTagSuggestions(INPUT, USER_ID)).rejects.toBeInstanceOf(AiOutputError);
  });

  it('throws when the reply ran out of tokens mid-JSON', async () => {
    create.mockResolvedValue(reply('{"tags": ["rea', 'incomplete', 'max_output_tokens'));

    await expect(generateTagSuggestions(INPUT, USER_ID)).rejects.toBeInstanceOf(AiOutputError);
  });

  it('throws when the reply is empty or not the JSON asked for', async () => {
    create.mockResolvedValue(reply(''));
    await expect(generateTagSuggestions(INPUT, USER_ID)).rejects.toBeInstanceOf(AiOutputError);

    create.mockResolvedValue(reply('Here are some tags: react, hooks'));
    await expect(generateTagSuggestions(INPUT, USER_ID)).rejects.toBeInstanceOf(AiOutputError);
  });

  it('lets SDK errors through for the caller to map', async () => {
    const failure = new Error('network');
    create.mockRejectedValue(failure);

    await expect(generateTagSuggestions(INPUT, USER_ID)).rejects.toBe(failure);
  });
});

describe('generateDescriptionSummary', () => {
  const SUMMARY_INPUT = {
    title: 'useDebounce Hook',
    typeName: 'snippet',
    content: 'const x = 1;',
    language: 'typescript',
    tags: ['react'],
  };

  beforeEach(() => {
    create.mockResolvedValue(reply('Summary: Debounces a value.\nUseful for search inputs.'));
  });

  it('asks for plain text with the same privacy and cost settings as tagging', async () => {
    await generateDescriptionSummary(SUMMARY_INPUT, USER_ID);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-nano',
        text: { format: { type: 'text' }, verbosity: 'low' },
        reasoning: { effort: 'minimal' },
        store: false,
        safety_identifier: safetyIdentifier(USER_ID),
        max_output_tokens: expect.any(Number),
      }),
    );
  });

  it('sends the summary instructions separately from the item', async () => {
    await generateDescriptionSummary(SUMMARY_INPUT, USER_ID);

    const [params] = create.mock.calls[0];

    expect(params.instructions).toMatch(/one or two/i);
    expect(params.input).toContain('Type: snippet');
    expect(params.input).toContain('Title: useDebounce Hook');
  });

  it('sends content truncated at the summary ceiling, not the tagging one', async () => {
    const content = 'x'.repeat(SUMMARY_CONTENT_MAX_LENGTH * 3);

    await generateDescriptionSummary({ ...SUMMARY_INPUT, content }, USER_ID);

    const [params] = create.mock.calls[0];

    expect(params.input.length).toBeGreaterThan(SUMMARY_CONTENT_MAX_LENGTH);
    expect(params.input.length).toBeLessThan(SUMMARY_CONTENT_MAX_LENGTH + 200);
  });

  it('returns the reply cleaned up', async () => {
    await expect(generateDescriptionSummary(SUMMARY_INPUT, USER_ID)).resolves.toBe(
      'Debounces a value. Useful for search inputs.',
    );
  });

  it('throws for an incomplete reply even when it has text', async () => {
    create.mockResolvedValue(reply('Debounces a', 'incomplete', 'max_output_tokens'));

    await expect(generateDescriptionSummary(SUMMARY_INPUT, USER_ID)).rejects.toBeInstanceOf(
      AiOutputError,
    );
  });

  it('throws when nothing is left of the reply', async () => {
    create.mockResolvedValue(reply('  \n '));

    await expect(generateDescriptionSummary(SUMMARY_INPUT, USER_ID)).rejects.toBeInstanceOf(
      AiOutputError,
    );
  });

  it('lets SDK errors through for the caller to map', async () => {
    const failure = new Error('network');
    create.mockRejectedValue(failure);

    await expect(generateDescriptionSummary(SUMMARY_INPUT, USER_ID)).rejects.toBe(failure);
  });
});
