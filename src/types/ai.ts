/**
 * What every AI action returns. AI actions suggest and never write, so success
 * carries only the suggestion.
 *
 * `upgradeRequired` marks the Pro refusal, the same flag `CreateItemResult`
 * carries, so the client shows it through `useUpgradeToast` rather than as a
 * failure.
 */
export type AiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; upgradeRequired?: true };

export type GenerateAutoTagsResult = AiResult<{ tags: string[] }>;

export type GenerateSummaryResult = AiResult<{ summary: string }>;
