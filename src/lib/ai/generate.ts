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
import { AI_MODEL, getOpenAI } from '@/lib/openai';

/**
 * Lets OpenAI attribute abuse to one account without being told who it is: a
 * SHA-256 hex digest, exactly the 64 characters the field allows. Never the raw
 * id, and never the email.
 */
export function safetyIdentifier(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

/**
 * Asks the model for tag suggestions for one item.
 *
 * The one place the tagging feature touches the SDK, so it is the boundary the
 * action's tests mock. Uses the Responses API: gpt-5-nano returns empty content
 * through Chat Completions. `json_object` rather than a JSON schema, because
 * schema-constrained output burns this model's tokens until it hits the cap —
 * so the reply's shape is checked by hand in `parseTagSuggestions`.
 *
 * Throws `AiOutputError` for a reply that came back but holds nothing usable,
 * and lets the SDK's own errors through; `describeAiError` sorts out both.
 */
export async function generateTagSuggestions(
  input: AutoTagInput,
  userId: string,
): Promise<string[]> {
  const response = await getOpenAI().responses.create({
    model: AI_MODEL,
    // Static first, variable last — costs nothing, and lets a cached prefix
    // apply if the instructions ever grow past the caching threshold.
    instructions: AUTO_TAG_INSTRUCTIONS,
    input: buildAutoTagInput(input),
    text: { format: { type: 'json_object' }, verbosity: 'low' },
    // Reasoning tokens bill as output at eight times the input price, and
    // naming a technology does not need much of it.
    reasoning: { effort: 'minimal' },
    // Reasoning counts against this cap, so it leaves headroom well beyond
    // the few dozen tokens the tags themselves need.
    max_output_tokens: 1000,
    // Responses are otherwise kept on OpenAI's side for 30 days, and nothing
    // here ever refers back to one.
    store: false,
    safety_identifier: safetyIdentifier(userId),
  });

  console.info('AI auto-tag usage:', {
    requestId: response._request_id,
    status: response.status,
    usage: response.usage,
  });

  if (response.status === 'incomplete') {
    throw new AiOutputError(
      `Auto-tag response incomplete: ${response.incomplete_details?.reason ?? 'unknown'}`,
    );
  }

  const tags = parseTagSuggestions(response.output_text);

  if (!tags) {
    throw new AiOutputError('Auto-tag response was not the expected JSON');
  }

  return normalizeSuggestedTags(tags, input.currentTags);
}
