import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

/** One sliding window: how many requests, over how long. */
type LimitConfig = { limit: number; window: `${number} ${'s' | 'm' | 'h'}` };

/**
 * Sliding-window limits for the auth surface, keyed per action so one cannot
 * eat another's budget.
 *
 * Every window here is a deliberate trade between stopping online guessing and
 * stranding someone who genuinely mistyped. The two that send email are the
 * tightest, because their abuse lands in a stranger's inbox rather than only
 * on our own server.
 */
export const AUTH_RATE_LIMITS = {
  signIn: { limit: 5, window: '15 m' },
  register: { limit: 3, window: '1 h' },
  forgotPassword: { limit: 3, window: '1 h' },
  resetPassword: { limit: 5, window: '15 m' },
  resendVerification: { limit: 3, window: '15 m' },
} as const satisfies Record<string, LimitConfig>;

export type RateLimitAction = keyof typeof AUTH_RATE_LIMITS;

/**
 * One budget shared by every AI feature, keyed per user rather than per IP —
 * AI is signed-in only, and a shared office IP should not share a budget.
 *
 * Shared across features so a user cannot sidestep the cap by switching
 * buttons. Unlike the auth limits this one protects spend: OpenAI's own limits
 * are for the whole project, so one heavy account could otherwise starve the
 * rest and run up the bill.
 */
export const AI_RATE_LIMITS = {
  ai: { limit: 20, window: '1 h' },
} as const satisfies Record<string, LimitConfig>;

/** What every caller gets back, whether or not Upstash was reachable. */
export interface RateLimitResult {
  /** False only when Upstash positively said the caller is over the limit. */
  success: boolean;
  /** Requests left in the window. `Infinity` when limiting is not running. */
  remaining: number;
  /** Unix ms when the window resets. `0` when limiting is not running. */
  reset: number;
}

/** Limiting is off rather than failed — nothing was consulted, so nothing is refused. */
const NOT_LIMITED: RateLimitResult = { success: true, remaining: Infinity, reset: 0 };

/**
 * Built once per key prefix and reused. Lazy rather than at module scope: the
 * variables are read at call time so `next build` cannot bake in whatever was
 * (or was not) set on the build machine — the same rule `src/lib/features.ts`
 * follows.
 */
const limiters = new Map<string, Ratelimit>();

let redis: Redis | undefined;
let warnedUnconfigured = false;

/**
 * Whether both Upstash variables are present.
 *
 * Checked here rather than leaning on `Redis.fromEnv()`, which does **not**
 * throw when they are missing — it logs four warnings and hands back a client
 * whose every call fails against an undefined URL. Deciding up front keeps
 * "never configured" separable from "configured but unreachable", and keeps
 * that noise out of the log on every single request.
 */
function readConfig(): { url: string; token: string } | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) return undefined;

  return { url, token };
}

/**
 * The limiter for one key prefix, or `undefined` when Upstash is not
 * configured. Each prefix is its own key space, so no two budgets can be spent
 * against each other.
 */
function getLimiter(prefix: string, { limit, window }: LimitConfig): Ratelimit | undefined {
  const cached = limiters.get(prefix);

  if (cached) return cached;

  const config = readConfig();

  if (!config) {
    // Once per process, not once per request. Loud enough that an
    // unconfigured deploy is not mistaken for a protected one — the auth
    // limits fail open by design, so silence here would be indistinguishable
    // from working.
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn(
        'Rate limiting is DISABLED: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not both set. Auth endpoints are unprotected and AI features are refused.',
      );
    }

    return undefined;
  }

  redis ??= new Redis(config);

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
    // Upstash counts a slow call as a pass, reported as `reason: 'timeout'`.
    // Availability beats enforcement for auth — a Redis hiccup must not lock
    // every user out of signing in — and `checkAiRateLimit` treats the same
    // pass as a refusal.
    timeout: 1000,
  });

  limiters.set(prefix, limiter);

  return limiter;
}

/**
 * The caller's IP, from the proxy header Vercel sets.
 *
 * Trustworthy only behind a proxy that overwrites it — Vercel does. Run
 * directly with no proxy in front and a client can send whatever it likes, so
 * this is a speed bump against a determined attacker and a real limit against
 * ordinary abuse.
 *
 * `next dev` sets the header itself (to `::1` over loopback), so local
 * requests key on that rather than falling through to `unknown` — worth
 * knowing when a limit seems to follow you across browsers.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();

  // A chain of proxies appends; the first entry is the original client.
  const forwarded = headerList.get('x-forwarded-for');

  if (forwarded) {
    const [first] = forwarded.split(',');

    if (first?.trim()) return first.trim();
  }

  return headerList.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Consumes one token for `action` against `identifier`.
 *
 * **Fails open.** An unconfigured or unreachable Upstash lets the request
 * through rather than refusing it, so an outage cannot lock every user out of
 * their own account. That is the opposite of the fail-secure call
 * `EMAIL_VERIFICATION` makes, and deliberately so: this protects against
 * volume, and being wrong in the safe direction here means denial of service.
 */
export async function checkRateLimit(
  action: RateLimitAction,
  identifier: string,
): Promise<RateLimitResult> {
  // `devfetch:auth:<action>`, exactly as before the AI limits existed, so no
  // live bucket was reset by adding them.
  const limiter = getLimiter(`devfetch:auth:${action}`, AUTH_RATE_LIMITS[action]);

  if (!limiter) return NOT_LIMITED;

  try {
    const { success, remaining, reset, reason } = await limiter.limit(identifier);

    // A timeout is Upstash letting the request through because Redis did not
    // answer in time — not because the caller was under the limit. It returns
    // `success: true` rather than throwing, so without this the endpoint would
    // be silently unprotected for the whole outage.
    if (reason === 'timeout') {
      console.error(
        `Rate limit check timed out for "${action}", allowing the request. Upstash is slow or unreachable.`,
      );
    }

    return { success, remaining, reset };
  } catch (error) {
    // Unreachable, bad credentials, quota exhausted — all of it lets the
    // request through, but none of it passes quietly.
    console.error(`Rate limit check failed for "${action}", allowing the request:`, error);

    return NOT_LIMITED;
  }
}

/** What an AI rate-limit check decided. */
export type AiRateLimitResult =
  | { status: 'allowed' }
  | { status: 'limited'; reset: number }
  /** Upstash could not be asked, so the request is refused rather than paid for. */
  | { status: 'unavailable' };

/**
 * Consumes one token of the user's shared AI budget.
 *
 * **Fails closed**, the opposite of `checkRateLimit`. For auth, an outage that
 * refused every request would lock everyone out of their account; here, one
 * that allowed every request would mean unlimited paid OpenAI calls for as
 * long as it lasted, while AI is never on anyone's critical path. So an
 * unconfigured, unreachable or timed-out Upstash is `unavailable`, not a pass.
 */
export async function checkAiRateLimit(userId: string): Promise<AiRateLimitResult> {
  const limiter = getLimiter('devfetch:ai', AI_RATE_LIMITS.ai);

  if (!limiter) return { status: 'unavailable' };

  try {
    const { success, reset, reason } = await limiter.limit(userId);

    // A timeout comes back as `success: true` — Upstash letting the request
    // through because Redis did not answer, not because the user is under
    // the limit.
    if (reason === 'timeout') {
      console.error('AI rate limit check timed out, refusing the request. Upstash is slow or unreachable.');

      return { status: 'unavailable' };
    }

    return success ? { status: 'allowed' } : { status: 'limited', reset };
  } catch (error) {
    console.error('AI rate limit check failed, refusing the request:', error);

    return { status: 'unavailable' };
  }
}

/** Keyed by IP alone — the address is not part of what is being limited. */
export async function checkIpRateLimit(action: RateLimitAction): Promise<RateLimitResult> {
  return checkRateLimit(action, await getClientIp());
}

/**
 * Keyed by IP **and** address, so one attacker cannot spend a shared office
 * IP's whole budget guessing at one account and lock everyone else out — and
 * so a single address cannot be email-bombed from one machine.
 *
 * The email is normalized here because the buckets must agree however it was
 * typed; `Foo@Bar.com` and `foo@bar.com` are one account and so are one key.
 */
export async function checkIpEmailRateLimit(
  action: RateLimitAction,
  email: string,
): Promise<RateLimitResult> {
  const ip = await getClientIp();

  return checkRateLimit(action, `${ip}:${email.trim().toLowerCase()}`);
}

/** Whole seconds until the window resets, floored at 1 so it is never `0`. */
export function retryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

/**
 * The one message every limited-out path shows. Says when to come back rather
 * than only that something was refused, so the wait is not a guess.
 */
export function rateLimitMessage(reset: number): string {
  const seconds = retryAfterSeconds(reset);

  if (seconds <= 60) {
    return 'Too many attempts. Please try again in a minute.';
  }

  const minutes = Math.ceil(seconds / 60);

  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

/**
 * The AI limit's own wording. `rateLimitMessage` says "Too many attempts",
 * which reads as a failed sign-in rather than a spent allowance.
 */
export function aiRateLimitMessage(reset: number): string {
  const minutes = Math.ceil(retryAfterSeconds(reset) / 60);

  if (minutes <= 1) {
    return 'You have used your AI requests for now. Try again in a minute.';
  }

  return `You have used your AI requests for now. Try again in ${minutes} minutes.`;
}
