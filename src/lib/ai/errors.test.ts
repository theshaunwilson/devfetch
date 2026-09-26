import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';
import { describe, expect, it } from 'vitest';

import { AiOutputError, describeAiError } from './errors';

const UNAVAILABLE = 'AI features are unavailable right now.';

function headers() {
  return new Headers({ 'x-request-id': 'req_123' });
}

describe('describeAiError', () => {
  it('treats an unusable reply as retryable', () => {
    expect(describeAiError(new AiOutputError('incomplete'))).toEqual({
      message: 'The AI could not come up with suggestions. Try again.',
      severity: 'warn',
    });
  });

  it('tells a timeout apart from the connection error it subclasses', () => {
    expect(describeAiError(new APIConnectionTimeoutError())).toEqual({
      message: 'That took too long. Try again.',
      severity: 'warn',
    });
    expect(describeAiError(new APIConnectionError({}))).toEqual({
      message: 'Could not reach the AI service. Try again.',
      severity: 'warn',
    });
  });

  it('treats an exhausted quota as an outage for us to fix, not throttling', () => {
    const quota = new RateLimitError(429, { code: 'insufficient_quota' }, 'quota', headers());
    // The shape a real account with no credit returned: the signal is in
    // `type`, and `code` names something else entirely.
    const noCredit = new RateLimitError(
      429,
      { type: 'insufficient_quota', code: 'credit_balance_exhausted' },
      'no credits',
      headers(),
    );
    const busy = new RateLimitError(
      429,
      { type: 'requests', code: 'rate_limit_exceeded' },
      'busy',
      headers(),
    );

    expect(describeAiError(quota)).toEqual({ message: UNAVAILABLE, severity: 'error' });
    expect(describeAiError(noCredit)).toEqual({ message: UNAVAILABLE, severity: 'error' });
    expect(describeAiError(busy)).toEqual({
      message: 'AI is busy right now. Try again in a moment.',
      severity: 'warn',
    });
  });

  it('treats a bad or unauthorized key as unavailable and loud', () => {
    expect(describeAiError(new AuthenticationError(401, {}, 'bad key', headers()))).toEqual({
      message: UNAVAILABLE,
      severity: 'error',
    });
    expect(describeAiError(new PermissionDeniedError(403, {}, 'no access', headers()))).toEqual({
      message: UNAVAILABLE,
      severity: 'error',
    });
  });

  it('treats a missing key as unavailable', () => {
    expect(describeAiError(new Error('OPENAI_API_KEY is not set'))).toEqual({
      message: UNAVAILABLE,
      severity: 'error',
    });
  });

  it('treats an OpenAI outage as transient', () => {
    expect(describeAiError(new InternalServerError(500, {}, 'down', headers()))).toEqual({
      message: 'AI is having trouble right now. Try again later.',
      severity: 'warn',
    });
  });

  it('treats a bad request as our bug', () => {
    expect(describeAiError(new BadRequestError(400, {}, 'bad param', headers()))).toEqual({
      message: 'Something went wrong. Try again.',
      severity: 'error',
    });
  });

  it('never echoes the underlying message', () => {
    const errors = [
      new BadRequestError(400, {}, 'secret detail', headers()),
      new Error('secret detail'),
      'secret detail',
    ];

    for (const error of errors) {
      expect(describeAiError(error).message).not.toContain('secret detail');
    }
  });
});
