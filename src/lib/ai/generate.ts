import 'server-only';

import { createHash } from 'node:crypto';

import {
  AUTO_TAG_INSTRUCTIONS,
  buildAutoTagInput,
  normalizeSuggestedTags,
  parseTagSuggestions,
  type AutoTagInput,
} from '@/lib/ai/auto-tags';
import { AiOutputError } from '@/lib/ai/errors';
import {
  buildSummaryInput,
  clampSummary,
  SUMMARY_INSTRUCTIONS,
  type SummaryInput,
} from '@/lib/ai/summary';
import { AI_MODEL, getOpenAI } from '@/lib/openai';

/**
 * Lets OpenAI attribute abuse to one account without being told who it is: a
 * SHA-256 hex digest, exactly the 64 characters the field allows. Never the raw
 * id, and never the email.
 */
export function safetyIdentifier(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

/** One request's variable half: what the feature asks, and in what format. */
interface AiRequest {
  instructions: string;
  input: string;
  format: 'text' | 'json_object';
  /** Names the feature in the usage log and in an incomplete-reply error. */
  label: string;
}

/**
 * Sends one request with the settings every AI feature shares, and returns
 * the reply's text.
 *
 * Uses the Responses API: gpt-5-nano returns empty content through Chat
 * Completions. Throws `AiOutputError` for a reply cut short, and lets the
 * SDK's own errors through; `describeAiError` sorts out both.
 */
async function requestText(request: AiRequest, userId: string): Promise<string> {
  const response = await getOpenAI().responses.create({
    model: AI_MODEL,
    // Static first, variable last — costs nothing, and lets a cached prefix
    // apply if the instructions ever grow past the caching threshold.
    instructions: request.instructions,
    input: request.input,
    text: { format: { type: request.format }, verbosity: 'low' },
    // Reasoning tokens bill as output at eight times the input price, and
    // naming a technology or describing a snippet does not need much of it.
    reasoning: { effort: 'minimal' },
    // Reasoning counts against this cap, so it leaves headroom well beyond
    // the few dozen tokens either reply needs.
    max_output_tokens: 1000,
    // Responses are otherwise kept on OpenAI's side for 30 days, and nothing
    // here ever refers back to one.
    store: false,
    safety_identifier: safetyIdentifier(userId),
  });

  console.info(`AI ${request.label} usage:`, {
    requestId: response._request_id,
    status: response.status,
    usage: response.usage,
  });

  if (response.status === 'incomplete') {
    throw new AiOutputError(
      `${request.label} response incomplete: ${response.incomplete_details?.reason ?? 'unknown'}`,
    );
  }

  return response.output_text;
}

/**
 * Asks the model for tag suggestions for one item.
 *
 * The one place the tagging feature touches the SDK, so it is the boundary the
 * action's tests mock. `json_object` rather than a JSON schema, because
 * schema-constrained output burns this model's tokens until it hits the cap —
 * so the reply's shape is checked by hand in `parseTagSuggestions`.
 *
 * Throws `AiOutputError` for a reply that came back but holds nothing usable.
 */
export async function generateTagSuggestions(
  input: AutoTagInput,
  userId: string,
): Promise<string[]> {
  const text = await requestText(
    {
      instructions: AUTO_TAG_INSTRUCTIONS,
      input: buildAutoTagInput(input),
      format: 'json_object',
      label: 'auto-tag',
    },
    userId,
  );

  const tags = parseTagSuggestions(text);

  if (!tags) {
    throw new AiOutputError('Auto-tag response was not the expected JSON');
  }

  return normalizeSuggestedTags(tags, input.currentTags);
}

/**
 * Asks the model for a one- or two-sentence description of one item.
 *
 * Plain text, so there is no shape to check — only whether anything is left
 * once `clampSummary` has cleaned it up. Throws `AiOutputError` when nothing
 * is.
 */
export async function generateDescriptionSummary(
  input: SummaryInput,
  userId: string,
): Promise<string> {
  const text = await requestText(
    {
      instructions: SUMMARY_INSTRUCTIONS,
      input: buildSummaryInput(input),
      format: 'text',
      label: 'summary',
    },
    userId,
  );

  const summary = clampSummary(text);

  if (!summary) {
    throw new AiOutputError('Summary response was empty');
  }

  return summary;
}
