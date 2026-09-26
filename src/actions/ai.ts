'use server';

import { auth } from '@/auth';
import { describeAiError } from '@/lib/ai/errors';
import { generateTagSuggestions } from '@/lib/ai/generate';
import { isProUser } from '@/lib/db/billing';
import { aiRateLimitMessage, checkAiRateLimit } from '@/lib/rate-limit';
import { generateAutoTagsSchema } from '@/lib/validation/ai';
import type { GenerateAutoTagsInput } from '@/lib/validation/ai';
import type { GenerateAutoTagsResult } from '@/types/ai';

/**
 * Suggests tags for an item from its title and content.
 *
 * Suggests and never writes: the item may not exist yet, and an accepted tag
 * goes into the form, so it still passes through `createItem` or `updateItem`
 * and their tag rules when the user saves. That is also why this takes text
 * rather than an item id — the user is sending back their own content, so there
 * is no ownership to check.
 *
 * The gates run cheapest-refusal first, and each one protects the next: no
 * session is refused before the Pro lookup, a free account is refused before
 * validation or any AI budget is spent, a malformed request is refused before
 * it can use up a rate-limit token, and only then does anything cost money.
 */
export async function generateAutoTags(
  input: GenerateAutoTagsInput,
): Promise<GenerateAutoTagsResult> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  // Read from the row, never the token: a lapsed subscription in a JWT would
  // keep granting paid calls until the token refreshed.
  if (!(await isProUser())) {
    return {
      success: false,
      error: 'AI tag suggestions are part of Pro. Upgrade to use them.',
      upgradeRequired: true,
    };
  }

  const parsed = generateAutoTagsSchema.safeParse(input);

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
    const tags = await generateTagSuggestions(parsed.data, userId);

    return { success: true, data: { tags } };
  } catch (error) {
    const { message, severity } = describeAiError(error);

    console[severity]('AI auto-tag failed:', error);

    return { success: false, error: message };
  }
}
