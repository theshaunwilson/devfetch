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
import { buildExplainInput, cleanExplanation, EXPLAIN_INSTRUCTIONS, type ExplainInput } from '@/lib/ai/explain';
import {
  buildOptimizeInput,
  OPTIMIZE_INSTRUCTIONS,
  parseOptimization,
  type OptimizeInput,
} from '@/lib/ai/optimize';
import {
  buildSummaryInput,
  clampSummary,
  SUMMARY_INSTRUCTIONS,
  type SummaryInput,
} from '@/lib/ai/summary';
import { AI_MODEL, getOpenAI } from '@/lib/openai';
import type { PromptOptimization } from '@/types/ai';

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
  /**
   * How hard the model thinks. `minimal` unless the feature needs more:
   * reasoning tokens bill as output at eight times the input price.
   */
  effort?: 'minimal' | 'low';
  /** How much it writes around the answer. `low` unless the answer is prose. */
  verbosity?: 'low' | 'medium';
  /**
   * The output ceiling, reasoning included. The default leaves headroom well
   * beyond the few dozen tokens a tag list or a description needs.
   */
  maxOutputTokens?: number;
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
    text: { format: { type: request.format }, verbosity: request.verbosity ?? 'low' },
    reasoning: { effort: request.effort ?? 'minimal' },
    max_output_tokens: request.maxOutputTokens ?? 1000,
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

/** An explanation, and whether the code had to be cut to fit the prompt. */
export interface CodeExplanation {
  explanation: string;
  truncated: boolean;
}

/**
 * Asks the model to explain one snippet or command, as markdown.
 *
 * More room than the other features on every axis: `low` effort, because
 * following code takes a little thought where naming it does not; `medium`
 * verbosity, because the answer is the prose; and a larger ceiling, since a
 * 300-word explanation plus its reasoning would not fit in 1,000 tokens.
 * Throws `AiOutputError` when nothing usable came back.
 */
export async function generateCodeExplanation(
  input: ExplainInput,
  userId: string,
): Promise<CodeExplanation> {
  const built = buildExplainInput(input);
  const text = await requestText(
    {
      instructions: EXPLAIN_INSTRUCTIONS,
      input: built.input,
      format: 'text',
      label: 'explain',
      effort: 'low',
      verbosity: 'medium',
      maxOutputTokens: 3000,
    },
    userId,
  );

  const explanation = cleanExplanation(text);

  if (!explanation) {
    throw new AiOutputError('Explain response was empty');
  }

  return { explanation, truncated: built.truncated };
}

/**
 * Asks the model to review one prompt and rewrite it if it needs it.
 *
 * `low` effort, since judging whether a prompt holds up takes a little
 * thought, and a ceiling of 4,000 tokens: the reply carries the whole prompt
 * back, and a 20,000-character prompt is roughly that many tokens on its own.
 * `json_object` rather than a schema, for the reason tagging gives. Throws
 * `AiOutputError` when the reply is unusable, including a rewrite that dropped
 * one of the prompt's placeholders.
 */
export async function generatePromptOptimization(
  input: OptimizeInput,
  userId: string,
): Promise<PromptOptimization> {
  const text = await requestText(
    {
      instructions: OPTIMIZE_INSTRUCTIONS,
      input: buildOptimizeInput(input),
      format: 'json_object',
      label: 'optimize',
      effort: 'low',
      maxOutputTokens: 4000,
    },
    userId,
  );

  const optimization = parseOptimization(text, input.content);

  if (!optimization) {
    throw new AiOutputError('Optimize response was not usable');
  }

  return optimization;
}
