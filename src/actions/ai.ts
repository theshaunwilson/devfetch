'use server';

import type { z } from 'zod';

import { auth } from '@/auth';
import { AiRequestError, describeAiError } from '@/lib/ai/errors';
import {
  generateCodeExplanation,
  generateDescriptionSummary,
  generateTagSuggestions,
} from '@/lib/ai/generate';
import { isProUser } from '@/lib/db/billing';
import { getItemDetail } from '@/lib/db/items';
import { usesCodeEditor } from '@/lib/items';
import { aiRateLimitMessage, checkAiRateLimit } from '@/lib/rate-limit';
import {
  explainCodeSchema,
  generateAutoTagsSchema,
  generateSummarySchema,
} from '@/lib/validation/ai';
import type {
  ExplainCodeInput,
  GenerateAutoTagsInput,
  GenerateSummaryInput,
} from '@/lib/validation/ai';
import type {
  AiResult,
  ExplainCodeResult,
  GenerateAutoTagsResult,
  GenerateSummaryResult,
} from '@/types/ai';

/** What differs between one AI action and the next. */
interface AiActionSpec<Schema extends z.ZodType, T> {
  schema: Schema;
  /** The refusal a free account sees, naming the feature it asked for. */
  proMessage: string;
  /** Names the feature in the server log when the call fails. */
  label: string;
  run: (data: z.output<Schema>, userId: string) => Promise<T>;
}

/**
 * Runs an AI action behind the gates every one of them shares.
 *
 * The gates run cheapest-refusal first, and each one protects the next: no
 * session is refused before the Pro lookup, a free account is refused before
 * validation or any AI budget is spent, a malformed request is refused before
 * it can use up a rate-limit token, and only then does anything cost money.
 *
 * Not exported: a `'use server'` module's exports are public endpoints, and
 * this takes a function.
 */
async function runAiAction<Schema extends z.ZodType, T>(
  input: unknown,
  spec: AiActionSpec<Schema, T>,
): Promise<AiResult<T>> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  // Read from the row, never the token: a lapsed subscription in a JWT would
  // keep granting paid calls until the token refreshed.
  if (!(await isProUser())) {
    return { success: false, error: spec.proMessage, upgradeRequired: true };
  }

  const parsed = spec.schema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Add a title or some content first.',
    };
  }

  const limit = await checkAiRateLimit(userId);

  if (limit.status === 'limited') {
    return { success: false, error: aiRateLimitMessage(limit.reset) };
  }

  if (limit.status === 'unavailable') {
    return { success: false, error: 'AI features are unavailable right now.' };
  }

  try {
    return { success: true, data: await spec.run(parsed.data, userId) };
  } catch (error) {
    const { message, severity } = describeAiError(error);

    console[severity](`AI ${spec.label} failed:`, error);

    return { success: false, error: message };
  }
}

/**
 * Suggests tags for an item from its title and content.
 *
 * Suggests and never writes: the item may not exist yet, and an accepted tag
 * goes into the form, so it still passes through `createItem` or `updateItem`
 * and their tag rules when the user saves. That is also why this takes text
 * rather than an item id — the user is sending back their own content, so there
 * is no ownership to check.
 */
export async function generateAutoTags(
  input: GenerateAutoTagsInput,
): Promise<GenerateAutoTagsResult> {
  return runAiAction(input, {
    schema: generateAutoTagsSchema,
    proMessage: 'AI tag suggestions are part of Pro. Upgrade to use them.',
    label: 'auto-tag',
    run: async (data, userId) => ({ tags: await generateTagSuggestions(data, userId) }),
  });
}

/**
 * Writes a one- or two-sentence description of an item from whatever the form
 * currently holds for its type.
 *
 * Never writes, for the reasons `generateAutoTags` does not: the summary goes
 * into the Description field and is saved — within `DESCRIPTION_MAX_LENGTH` —
 * only by the form's own Save.
 */
export async function generateSummary(
  input: GenerateSummaryInput,
): Promise<GenerateSummaryResult> {
  return runAiAction(input, {
    schema: generateSummarySchema,
    proMessage: 'AI descriptions are part of Pro. Upgrade to use them.',
    label: 'summary',
    run: async (data, userId) => ({
      summary: await generateDescriptionSummary(data, userId),
    }),
  });
}

/**
 * Explains one saved snippet or command, as markdown.
 *
 * The one AI action that takes an item id rather than text, because it runs
 * from the drawer's read view on what is saved. So it is also the one with an
 * ownership surface: the row is read through `getItemDetail`, which is scoped
 * to the signed-in user, and somebody else's item reads exactly like one that
 * never existed. The lookup runs after the rate limit, so probing ids costs
 * budget like any other request.
 *
 * Never writes: an explanation is shown in the drawer and regenerated on the
 * next click.
 */
export async function explainCode(input: ExplainCodeInput): Promise<ExplainCodeResult> {
  return runAiAction(input, {
    schema: explainCodeSchema,
    proMessage: 'AI code explanations are part of Pro. Upgrade to use them.',
    label: 'explain',
    run: async (data, userId) => {
      const item = await getItemDetail(data.itemId);

      if (!item) {
        throw new AiRequestError('That item could not be found.');
      }

      // The button only renders for code types, but the gate is not
      // client-only: a caller can send any id it owns.
      if (!usesCodeEditor(item.type.slug) || !item.content?.trim()) {
        throw new AiRequestError('Only snippets and commands with code can be explained.');
      }

      return generateCodeExplanation(
        {
          title: item.title,
          typeName: item.type.name,
          content: item.content,
          language: item.language,
        },
        userId,
      );
    },
  });
}
