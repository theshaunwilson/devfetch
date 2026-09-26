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

/**
 * An explanation is shown and never saved. `truncated` says the code was too
 * long to send whole, so the drawer can say the explanation covers only its
 * beginning.
 */
export type ExplainCodeResult = AiResult<{ explanation: string; truncated: boolean }>;
