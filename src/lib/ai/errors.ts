import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';

/**
 * The model answered, but not with anything usable: the reply ran out of
 * tokens (reasoning counts against the cap), was filtered, was a refusal, or
 * was not the JSON asked for. The SDK does not throw for any of these.
 */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiOutputError';
  }
}

/**
 * The request cannot be served before the model is ever asked: the item it
 * names is missing, somebody else's, or not code. Its message is written for
 * the user and is shown as is — unlike the SDK's, it carries nothing internal.
 */
export class AiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiRequestError';
  }
}

/**
 * How to report one AI failure: the sentence the user sees, and how loudly to
 * log it. `error` is for failures that are ours to fix — a missing or revoked
 * key, an exhausted budget, a bad request — and `warn` for the transient ones
 * a retry may clear.
 */
export interface AiErrorReport {
  message: string;
  severity: 'error' | 'warn';
}

const UNAVAILABLE = 'AI features are unavailable right now.';
const GENERIC = 'Something went wrong. Try again.';

/**
 * Maps an AI failure to a sentence the user can act on.
 *
 * Never echoes the SDK's own message, which can carry request details. The
 * order matters: the timeout is a subclass of the connection error, and
 * `insufficient_quota` arrives as a 429 — so specific cases are tested first.
 */
export function describeAiError(error: unknown): AiErrorReport {
  if (error instanceof AiRequestError) {
    return { message: error.message, severity: 'warn' };
  }

  if (error instanceof AiOutputError) {
    // Worded for every feature, not only suggestions: an explanation can
    // come back empty too.
    return { message: 'The AI did not come back with anything usable. Try again.', severity: 'warn' };
  }

  if (error instanceof APIConnectionTimeoutError) {
    return { message: 'That took too long. Try again.', severity: 'warn' };
  }

  if (error instanceof APIConnectionError) {
    return { message: 'Could not reach the AI service. Try again.', severity: 'warn' };
  }

  if (error instanceof RateLimitError) {
    // Out of credit or over the project budget: somebody has to top it up,
    // and no retry will help until they do. Read off `type` as well as
    // `code` — a real empty account answers `type: 'insufficient_quota'`
    // with `code: 'credit_balance_exhausted'`, so checking `code` alone
    // would report it as ordinary throttling.
    if (error.type === 'insufficient_quota' || error.code === 'insufficient_quota') {
      return { message: UNAVAILABLE, severity: 'error' };
    }

    return { message: 'AI is busy right now. Try again in a moment.', severity: 'warn' };
  }

  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return { message: UNAVAILABLE, severity: 'error' };
  }

  if (error instanceof InternalServerError) {
    return { message: 'AI is having trouble right now. Try again later.', severity: 'warn' };
  }

  // Our request was wrong — a bug, not the user's doing.
  if (error instanceof BadRequestError || error instanceof APIError) {
    return { message: GENERIC, severity: 'error' };
  }

  // `getOpenAI()` throws this when the deploy has no key.
  if (error instanceof Error && error.message === 'OPENAI_API_KEY is not set') {
    return { message: UNAVAILABLE, severity: 'error' };
  }

  return { message: GENERIC, severity: 'error' };
}
