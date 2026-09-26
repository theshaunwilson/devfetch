# AI Integration Plan — DevFetch Pro

Research for the four AI features the spec promises Pro users — auto-tagging,
summaries, code explanation and prompt optimization — on OpenAI's
`gpt-5-nano`. It says what to build, where it goes in this codebase and why,
and lists the decisions that need settling before anyone writes code.

Researched 2026-09-26 against `openai@7.23.0` (the latest on npm that day). The
SDK facts below come from its installed type definitions and from probing it
directly, not from memory. Section 12 lists sources.

---

## 1. Current state

### 1.1 Nothing is built, but everything around it is

`context/project-overview.md` lists "every AI feature" as not built. The
homepage already sells them: `PRO_PLAN.features` in
`src/components/home/content.tsx` promises "AI tagging, summaries, explanations
and prompt tuning", and `AI_CHECKLIST` promises:

- "Tags every item the moment you save it"
- "Summarizes a long note into a line you can scan"
- "Explains unfamiliar code in plain language"
- "Turns a rough prompt into one that holds up"

The first line promises **automatic** tagging on save. The rest of this plan
recommends suggest-then-accept (§4.1), so either the copy or the design has to
move — see decision D1 in §10.

### 1.2 The environment variable

`OPENAI_API_KEY` is in `.env.example` (blank, uncommitted), `.env` and
`.env.production` (both set, both gitignored). The name matches what the SDK
reads by default. Two things to carry forward from the Stripe incident in
History:

- `.env.production` is **untracked and never reaches Vercel**. The key has to
  be set in the Vercel project's environment variables separately, or
  production has no AI at all.
- The committed comment reads `# Open AI Key`. Every other block in
  `.env.example` explains where the value comes from and what happens when it
  is unset. Match that (§8.6).

### 1.3 No migration is needed for the first cut

Every AI output lands in a column that already exists, or in no column:

| Feature            | Output goes to                                   | Column exists? |
| ------------------ | ------------------------------------------------ | -------------- |
| Auto-tag           | the item's tags (`ItemTag` / `Tag`)              | yes            |
| Summary            | `Item.description` (`DESCRIPTION_MAX_LENGTH` 1000) | yes          |
| Prompt optimization | `Item.content`                                  | yes            |
| Explain code       | shown in the drawer, **not stored**              | n/a            |

Storing explanations would need a new column (or a table) and a way to handle
one going stale when the code changes. Out of scope for v1; see D4.

---

## 2. SDK setup and configuration

### 2.1 Package

```bash
npm install openai
```

- `openai@7.23.0`, `engines.node >=22` — local Node is `v24.7.0`. Vercel must
  run a Node 22+ runtime (check the project's Node version setting).
- `zod` is an **optional peer**, range `^3.25 || ^4.0`, so it works with this
  project's `zod@4.4.3`. Checked by running it: `zodTextFormat` turned a Zod 4
  `z.object` into a strict JSON schema with `additionalProperties: false`.
- Its other optional peers (`ws`, `undici`, the AWS signers) are for realtime,
  proxies and Bedrock. None are needed here.

### 2.2 The client must be lazy — confirmed by running it

`new OpenAI()` with no key **throws at construction**:

```
OpenAIError - Missing credentials. Please pass an `apiKey`, ... or set the `OPENAI_API_KEY` ...
```

That is the trap `src/lib/email/client.ts` hit with `new Resend(undefined)`,
and that `src/lib/stripe.ts` avoids. A module-scope client would break every
`next build` without the key, including CI. Copy `getStripe()` exactly:

```ts
// src/lib/openai.ts
// Fails the build if a client component imports this. The key must never be
// reachable from the browser bundle.
import 'server-only';

import OpenAI from 'openai';

/**
 * The one model the AI features run on. Named once so a model change is one
 * line — and so a test can assert every call site uses it.
 */
export const AI_MODEL = 'gpt-5-nano';

let client: OpenAI | undefined;

/**
 * The OpenAI client, built on first use. Throws when the key is missing —
 * like `getStripe()` and unlike `src/lib/rate-limit.ts`: with no key there is
 * no API to call, and pretending otherwise would fail every request silently.
 */
export function getOpenAI(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  client = new OpenAI({
    apiKey,
    // The SDK default is 10 minutes (600000 ms, confirmed on the instance). A
    // server action someone is waiting on should give up long before that.
    timeout: 30_000,
    // SDK default, stated so nobody "fixes" it. Retries cover 408/409/429/5xx
    // and connection errors with backoff; more than 2 just makes a failing
    // request take longer to report.
    maxRetries: 2,
  });

  return client;
}
```

Pass `apiKey` explicitly rather than relying on the SDK's env lookup, so the
`.trim()` and the throw belong to us and the test can stub `process.env` the
way `src/lib/stripe.test.ts` already does.

### 2.3 Use the Responses API, not Chat Completions

gpt-5-nano works on both. Responses is what OpenAI's current docs are written
against, and it has `responses.parse()` with `zodTextFormat`, which returns a
typed `output_parsed`. Every feature here returns structured data, so this is
the call to use:

```ts
import { zodTextFormat } from 'openai/helpers/zod';

const response = await getOpenAI().responses.parse({
  model: AI_MODEL,
  instructions: TAG_INSTRUCTIONS,          // static, first — see §7.3
  input: buildTagInput(item),              // the user's content, delimited
  text: { format: zodTextFormat(tagSuggestionSchema, 'tag_suggestions'), verbosity: 'low' },
  reasoning: { effort: 'minimal' },
  max_output_tokens: 1_000,
  store: false,
  safety_identifier: hashUserId(userId),
});

const parsed = response.output_parsed; // TagSuggestion | null
```

### 2.4 gpt-5-nano's parameters

From the model page (developers.openai.com/api/docs/models/gpt-5-nano):

| Property        | Value                                         |
| --------------- | --------------------------------------------- |
| Input price     | $0.05 / 1M tokens                             |
| Cached input    | $0.005 / 1M tokens                            |
| Output price    | $0.40 / 1M tokens (**reasoning tokens bill as output**) |
| Context         | 400k total, 272k max input, 128k max output   |
| Features        | streaming, structured outputs, function calling, prompt caching |
| Tier 1 limits   | 500 RPM, 200k TPM                             |
| Knowledge cutoff | May 31, 2024                                 |

**Reasoning effort.** The SDK type allows `none | minimal | low | medium | high
| xhigh | max`, but "not all reasoning models support every value". For
gpt-5-nano on the Responses endpoint the accepted values are `minimal`, `low`,
`medium` and `high`. `none` is a GPT-5.1-and-later value. An early web search
summary said nano *rejects* `minimal`; the thread it came from says the
opposite — the poster had sent the Chat Completions parameter shape to the
Responses endpoint. Verify with one real call during Phase 1 anyway.

**No `temperature` / `top_p`.** GPT-5 reasoning models reject non-default
sampling parameters (reported widely, e.g. LiteLLM issue #27351 for the 5.1
family). Control output with `reasoning.effort`, `text.verbosity` and the
prompt instead.

**The model is dated.** The cutoff is May 2024, so explanations of code using
libraries newer than that may be confidently wrong. Say so in the explain
panel's UI copy (§6.4). The spec names `gpt-5-nano`; if a newer nano model is
adopted later, its defaults differ (e.g. GPT-5.1 defaults to effort `none`),
which is one more reason `AI_MODEL` lives in one place.

---

## 3. Server action patterns

### 3.1 Server actions, not route handlers, for all four — at first

`coding-standards.md`: "Use Server Actions for form submissions and simple
mutations", and API routes for "long-running operations" and streaming. With
effort `minimal`/`low` and capped output, each call should come back within a
few seconds, and none of them mutate anything (§3.3). Server actions also get
Next's built-in CSRF protection (Origin check) for free.

The one exception worth planning for is streaming code explanations
(§5.3) — that needs a route handler.

The default server action body limit (`serverActions.bodySizeLimit`, 1 MB) is
not a problem: `CONTENT_MAX_LENGTH` is 100,000 characters, which is well under
1 MB even in multi-byte UTF-8, and §7.2 truncates what reaches OpenAI anyway.

### 3.2 The action shape

One module, `src/actions/ai.ts`, one exported action per feature. Each follows
the order `createItem` already uses, with rate limiting placed where the
forgot-password action places it (after the parse, so a malformed request does
not spend the budget):

```ts
'use server';

export async function suggestTags(input: SuggestTagsInput): Promise<SuggestTagsResult> {
  // 1. Session. The owner comes from here, never from the payload.
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Your session has expired. Sign in again.' };
  }

  // 2. Pro. Before the parse and the rate limit, so a free account spends
  //    neither validation work nor an AI budget it does not have.
  if (!(await isProUser())) {
    return {
      success: false,
      error: 'AI features are part of Pro. Upgrade to use them.',
      upgradeRequired: true,
    };
  }

  // 3. Validate. A server action is a public endpoint.
  const parsed = suggestTagsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'There is nothing to tag yet.' };
  }

  // 4. Rate limit, keyed by user id (§5.4).
  const limit = await checkRateLimit('ai', session.user.id);
  if (!limit.success) {
    return { success: false, error: aiRateLimitMessage(limit.reset) };
  }

  // 5. Call, map errors, normalize output.
  try {
    const tags = await generateTagSuggestions(parsed.data, session.user.id);
    return { success: true, data: { tags } };
  } catch (error) {
    return { success: false, error: aiErrorMessage(error) }; // §5.2
  }
}
```

Split the steps so each unit can be tested without the other:

| Module                          | Contents                                                        | Pure? |
| ------------------------------- | --------------------------------------------------------------- | ----- |
| `src/lib/openai.ts`             | `getOpenAI`, `AI_MODEL`                                         | no (`server-only`) |
| `src/lib/ai/prompts.ts`         | instruction strings, `build*Input()` delimiting and truncation  | yes   |
| `src/lib/ai/schemas.ts`         | the Zod **output** schemas passed to `zodTextFormat`            | yes   |
| `src/lib/ai/normalize.ts`       | `normalizeTags`, `clampSummary`, etc.                           | yes   |
| `src/lib/ai/errors.ts`          | `aiErrorMessage(error)` — SDK error → user sentence             | yes   |
| `src/lib/ai/features.ts`        | which item types get which feature (§6.1)                       | yes   |
| `src/lib/ai/generate.ts`        | the four `generate*` functions that call `getOpenAI()`          | no    |
| `src/lib/validation/ai.ts`      | the Zod **input** schemas for the actions                       | yes   |
| `src/actions/ai.ts`             | the four actions                                                | no    |
| `src/types/ai.ts`               | result types                                                    | —     |

The five pure modules carry most of the logic and get plain unit tests.
`generate.ts` is the one place the SDK is touched, so it is the module boundary
the action tests mock — the same rule as `@/lib/prisma`.

### 3.3 The key design decision: AI actions suggest, they never write

None of the four actions touches the database. Each takes text and returns a
suggestion. When the user accepts one, it goes into **form state**, and the
existing `createItem` / `updateItem` persist it when the user presses Save.

This is right for this codebase because:

- **All validation stays in one place.** A suggested tag still goes through
  `updateItemSchema`'s dedupe, the `TAG_MAX_LENGTH` / `TAGS_MAX_COUNT` caps and
  the delete-and-recreate tag write. A summary still hits
  `DESCRIPTION_MAX_LENGTH`. Nothing new can slip past those rules.
- **No ownership surface.** The actions take content, not an item id, so there
  is no IDOR to guard — the user is sending back their own text. (The
  exception is explain code in view mode, §6.4.)
- **It works before the item exists.** The create dialog has no id to send.
- **Undo is free.** Rejecting a suggestion, or cancelling the form, discards
  it. Nothing needs rolling back.

### 3.4 Result types

These follow `{ success, data, error }` and reuse the `upgradeRequired` flag
that `CreateItemResult` already carries, so `useUpgradeToast` works with no
changes:

```ts
// src/types/ai.ts
export type AiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; upgradeRequired?: true };

export type SuggestTagsResult = AiResult<{ tags: string[] }>;
export type SummarizeResult = AiResult<{ summary: string }>;
export type ExplainCodeResult = AiResult<{ explanation: string }>;
export type OptimizePromptResult = AiResult<{ prompt: string; changes: string[] }>;
```

---

## 4. Feature designs

### 4.1 Auto-tagging

- **Input:** title, description, content (or URL for links), language, the
  item's current tags, and — recommended — up to 50 of the user's **existing
  tag names**.
- **Why the existing tags:** `Tag` is `@@unique([userId, name])` and
  case-sensitive, so a model that invents `ReactJS` beside the user's `react`
  creates a new tag. Showing it the vocabulary costs ~150 input tokens
  (≈ $0.0000075) and gets tag reuse. That needs one small query,
  `getTagNames(limit)`, in a new `src/lib/db/tags.ts`, scoped by `userId`.
- **Output schema:** `z.object({ tags: z.array(z.string()) })`, asking for 3–5.
- **Normalize on the server** (`normalizeTags`, pure):
  trim, strip a leading `#`, collapse whitespace to `-`, drop blanks,
  truncate/drop anything over `TAG_MAX_LENGTH`, dedupe case-insensitively,
  **prefer the user's existing spelling** when one matches case-insensitively,
  drop tags already on the item, cap at 5.
- **Effort** `minimal`, **verbosity** `low`, `max_output_tokens` 1,000.
- **Links:** tag from title, description and the URL string. **Never fetch the
  URL** — that would be an SSRF vector, and it adds cost and latency.

### 4.2 Summaries

- **Target:** `Item.description`. Ask for one or two sentences, plain text, no
  markdown. `clampSummary` trims the result and cuts it at
  `DESCRIPTION_MAX_LENGTH` on a word boundary.
- **Applies to** notes and prompts, plus any type with content long enough to
  be worth it. Suggest enabling the button from about 300 characters of content
  — below that, the summary is the content.
- If the description field already has text, the accept button reads
  **Replace** rather than **Use**.
- Effort `minimal`, verbosity `low`, `max_output_tokens` 1,000.

### 4.3 Code explanation

- **Applies to** `usesCodeEditor(slug)` types — snippet and command.
- **Output:** markdown, rendered through the existing `MarkdownPreview`. That
  component keeps raw HTML disabled (verified with `<script>`, `onerror` and
  `javascript:` payloads during the markdown feature), which is what makes
  rendering model output safe. **Never add `rehype-raw`.**
- Schema: `z.object({ explanation: z.string() })`. Structured output is still
  worth it here: it avoids the model wrapping the answer in chatter.
- Effort `low` (explaining needs a little more thought than tagging),
  verbosity `medium`, `max_output_tokens` 3,000.
- Include `language` in the input, so a bash one-liner is not read as
  PowerShell.

### 4.4 Prompt optimization

- **Applies to** the prompt type only.
- **Output:** `z.object({ prompt: z.string(), changes: z.array(z.string()) })`.
  `changes` is 2–5 short bullets on what was changed and why. That list is what
  makes the suggestion reviewable without reading two long prompts side by
  side.
- The instructions must say: keep the user's intent, placeholders
  (`{{like_this}}`) and language; do not add facts; return the prompt only.
- Effort `low`, `max_output_tokens` 4,000. Cap the returned prompt at
  `CONTENT_MAX_LENGTH`.

---

## 5. Streaming, errors and rate limiting

### 5.1 Non-streaming for tags, summaries and prompts

These three return JSON that is useless until it is complete — a half-received
tag list cannot be shown. Their outputs are also short, so streaming would buy
almost nothing. Use `responses.parse()` and a pending state.

### 5.2 Error handling

Every SDK error extends `OpenAI.APIError` (checked in
`node_modules/openai/core/error.d.ts`) and carries `status`, `code`, `type` and
`requestID`. Map them in one pure function:

| Error                                    | Cause                                  | User sees                                             | Log |
| ---------------------------------------- | -------------------------------------- | ----------------------------------------------------- | --- |
| `Error('OPENAI_API_KEY is not set')`     | deploy misconfigured                   | "AI features are unavailable right now."              | `console.error`, loud |
| `AuthenticationError` (401)              | bad/revoked key                        | same                                                  | loud — our fault |
| `PermissionDeniedError` (403)            | project/model access                   | same                                                  | loud |
| `RateLimitError` (429), `code: 'insufficient_quota'` | **out of credit or over budget** | same                                           | loud — someone must top up |
| `RateLimitError` (429), other            | OpenAI throttling after SDK retries    | "AI is busy right now. Try again in a moment."        | warn |
| `APIConnectionTimeoutError`              | over the 30 s client timeout           | "That took too long. Try again."                      | warn |
| `APIConnectionError`                     | network                                | "Could not reach the AI service. Try again."          | warn |
| `BadRequestError` (400)                  | **our** request is wrong (bad param)   | "Something went wrong. Try again."                    | loud — a bug |
| `InternalServerError` (5xx)              | OpenAI outage after retries            | "AI is having trouble right now. Try again later."    | warn |
| anything else                            | —                                      | "Something went wrong. Try again."                    | error |

Always log `requestID` — it is what OpenAI support asks for. Never put the raw
SDK message in the UI, since it can include request details.

Three failures do not throw and have to be checked for:

1. **`response.status === 'incomplete'`** with
   `incomplete_details.reason === 'max_output_tokens'`. Reasoning tokens count
   against `max_output_tokens`, so a cap set too low can use itself up on
   reasoning and return **no text at all**. Treat this as a failure ("Could not
   finish — try again"), log it, and raise that feature's cap if it happens
   often.
2. **A refusal.** The model can return a `refusal` content part instead of the
   schema, which leaves `output_parsed` `null`. Treat `null` as "No suggestion
   for this one" — a harmless failure, not an error toast.
3. **An empty-but-valid result** (zero tags after normalization). Return
   success with an empty list and let the UI say "No new tags to suggest".

### 5.3 Streaming, if and when: code explanations only

Explanations are the one output long enough (hundreds of words) for
time-to-first-token to be noticeable. If Phase 3 testing shows the wait is
annoying, stream it:

- Use a **route handler** `POST /api/ai/explain`, per `coding-standards.md`,
  with the same session → Pro → parse → rate limit order. Like
  `/api/items/[id]`, it does **its own auth check**: `src/proxy.ts` does not
  match `/api`, and its answer to a signed-out request is a redirect that
  `fetch` would try to parse.
- Call `responses.create({ ..., stream: true })` without structured output (it
  is prose), and copy only the `response.output_text.delta` events' `delta`
  strings into a plain-text `ReadableStream`. The client then reads it with
  `fetch` + `getReader()` and needs no SDK. Treat `error`, `response.failed`
  and `response.incomplete` events as failure.
- Pass `request.signal` through the SDK's request options, so a closed drawer
  cancels the upstream call and stops spending tokens.
- Render the accumulating text in `MarkdownPreview`. Re-parsing on every chunk
  is fine at this size.

Libraries like the Vercel AI SDK solve this too, but they add a dependency to
replace roughly 30 lines. Not worth it for one streamed feature.

### 5.4 Rate limiting

OpenAI's own limits (500 RPM / 200k TPM at tier 1) are for the **whole
project**, so one abusive Pro account could starve everyone else. Limit per
user with the existing Upstash module.

`src/lib/rate-limit.ts` is written for auth: `RateLimitAction` is
`keyof typeof AUTH_RATE_LIMITS`, and the prefix is hardcoded
`devfetch:auth:${action}`. Generalize it without moving any existing bucket:

```ts
export const AI_RATE_LIMITS = {
  // One shared budget across all four features: a user cannot sidestep a cap
  // by switching buttons, and one number is easier to reason about than four.
  ai: { limit: 10, window: '1 m' },    // burst
  aiDaily: { limit: 150, window: '24 h' }, // cost ceiling — see §7.4
} as const satisfies Record<string, { limit: number; window: `${number} ${'s' | 'm' | 'h'}` }>;
```

- Note the window type only allows `s | m | h`, so a day is `'24 h'`, not
  `'1 d'`.
- Give each map its own namespace (`auth` / `ai`) and derive the prefix from
  it, so auth keys stay exactly `devfetch:auth:<action>` and no live bucket is
  reset.
- Check both limits in the action, and **key by `userId`**, not IP — AI is
  signed-in only, and a user on a shared office IP should not share a budget.
- Add `aiRateLimitMessage` beside `rateLimitMessage`. The existing text says
  "Too many attempts", which is auth wording.
- **Fail-open is a cost question here, not an availability one** — see D3.
  Today, an Upstash outage lets every request through. For auth that is right.
  For AI it means unlimited paid calls for as long as the outage lasts. The
  backstop either way is a monthly budget on the OpenAI project (§9).

---

## 6. UI patterns

### 6.1 Where each feature appears

Derive availability from the existing type helpers rather than a new list —
the anti-drift rule `usesCodeEditor`, `usesMarkdownEditor` and
`requiredFieldsFor` all follow:

```ts
// src/lib/ai/features.ts — pure
export function canSuggestTags(slug: string) { return !isProType(slug); }      // every text type, links included
export function canSummarize(slug: string) { return editableFieldsFor(slug).content; }
export function canExplainCode(slug: string) { return usesCodeEditor(slug); }  // snippet, command
export function canOptimizePrompt(slug: string) { return slug === 'prompt'; }
```

| Surface                          | Tags | Summary | Optimize | Explain |
| -------------------------------- | :--: | :-----: | :------: | :-----: |
| `NewItemForm` (create dialog)    |  ✓   |    ✓    |    ✓     |         |
| `ItemEditForm` (drawer, edit)    |  ✓   |    ✓    |    ✓     |         |
| `ItemDrawerBody` (drawer, view)  |      |         |          |    ✓    |

Explain goes in view mode because it reads the code rather than changing it.
The other three change fields, so they go where fields are editable.

### 6.2 Pro gating in the UI

Follow the precedent `NewItemDialog` set for File/Image: **show the control,
disabled and badged PRO; never hide it** — "a hidden feature cannot be sold".

- Free: the button renders with the outline `PRO` chip. Clicking it calls
  `useUpgradeToast()` directly, with no server round trip.
- The server still refuses (§3.2 step 2), and the client handles
  `upgradeRequired` from the result with the same hook. That covers a
  subscription that lapsed while the form was open.
- `isPro` already reaches `AppShell`. It needs threading to the edit form
  through `ItemDrawerProvider`, and to `NewItemForm` beside the `isPro` the
  create dialog already takes for the type gate.

### 6.3 The suggest → review → accept flow

One hook, `useAiSuggestion(action)`, in `src/hooks/`, beside `use-flag-toggle.ts`:

- **Trigger:** a small ghost button beside the field it fills — "Suggest tags"
  beside Tags, "Summarize" beside Description, "Improve prompt" above the
  prompt editor. Use `Wand` from lucide. **Not `Sparkles`**: that is the Prompt
  type's own icon (`prisma/seed.ts`), and the Upgrade button already skipped it
  for the same reason.
- **Pending:** `useTransition`. The label changes to "Suggesting…", the button
  disables, and a skeleton sits where the suggestion will appear. Keep the rest
  of the form usable.
- **Stale results:** snapshot the input when the request is sent. If the user
  edits the field before the result arrives, show the suggestion with a "based
  on an earlier version" note (or drop it) rather than applying it to text it
  was not written for.
- **Review, per feature:**
  - *Tags:* suggested tags as dashed-outline chips under the input, each with
    `+`, plus **Add all** and **Dismiss**. Accepting appends to the comma
    string that `parseTagInput` already reads.
  - *Summary:* a muted card with the text and **Use** / **Replace** /
    **Discard**.
  - *Prompt:* Before/After tabs (the `Tabs` the markdown editor already uses)
    with the `changes` bullets, then **Accept** / **Discard**. Accept replaces
    the editor content, and a toast offers **Undo**, which restores the
    snapshot.
  - *Explain:* a collapsible section in the drawer body under Content, with
    Copy and **Regenerate**, and a one-line note that it is AI-generated and
    may be wrong about libraries newer than mid-2024.
- **Nothing is saved on accept.** The form's own Save does it. Say so in the
  card copy ("Added — save to keep").
- **Toasts:** errors go through `toast.error` (bottom right), Pro refusals
  through `useUpgradeToast` (top centre, red). Success needs no toast: the
  suggestion appearing is the confirmation, the rule the favourite star
  follows.
- **Accessibility:** announce arrival through an `aria-live="polite"` region
  ("3 tags suggested"). Give each tag chip's button a real name
  ("Add tag react").

### 6.4 Explain code in view mode needs the item id

The drawer's view mode may not have loaded the content yet, and sending 100k
characters back from the client is wasteful. Recommended: this one action takes
`itemId`, loads the row with the existing `getItemDetail(id)`, which is
`findFirst` on `{ id, userId }`, and treats a miss as not-found — the ownership
pattern every id-taking action in this codebase uses.

---

## 7. Cost optimization

### 7.1 What a call costs

At $0.05 per 1M input and $0.40 per 1M output tokens, with reasoning billed as
output. These are estimates, to be replaced with real `usage` numbers from
Phase 1 logs (§9):

| Feature  | Input tokens (typical) | Output + reasoning | Cost per call |
| -------- | ---------------------- | ------------------ | ------------- |
| Tags     | ~3,500                 | ~300               | ~$0.0003      |
| Summary  | ~3,500                 | ~300               | ~$0.0003      |
| Optimize | ~2,000                 | ~1,500             | ~$0.0007      |
| Explain  | ~5,000                 | ~1,500             | ~$0.0009      |

A Pro user making 500 calls a month costs roughly **$0.15–$0.45**, against $8
(or $6 a year-billed) of revenue. The model is not the risk. **Unbounded
input** and **abuse** are.

### 7.2 Truncate input — this is the margin lever

`CONTENT_MAX_LENGTH` allows 100,000 characters, about 25,000 tokens. At the
daily cap that is the difference between cents and dollars per heavy user.

- Tags and summary: send the first ~12,000 characters. The opening of a note
  or snippet is what it is about.
- Explain and optimize: up to ~20,000 characters, and tell the user when it was
  cut ("Explained the first 400 lines").
- Truncate in the pure `build*Input()` functions, so a test pins it.

### 7.3 Prompt caching will barely apply — do not design around it

Caching is automatic and free to enable, but a prefix has to reach **1,024
tokens** before it is cacheable. These instructions are a few hundred tokens,
and the rest of each input is unique content. Still, put the static
`instructions` first and the variable content last — it costs nothing and
helps if instructions grow. Do not pad prompts to reach the threshold.

### 7.4 Other levers

- **Effort `minimal`/`low`, never the default.** Reasoning tokens bill as
  output at 8× the input price. This is the biggest per-call saving there is.
- **Tight `max_output_tokens` per feature** (§4) — a cost ceiling as well as a
  safety net. But leave headroom for reasoning (§5.2).
- **`verbosity: 'low'`** for tags and summaries.
- **The daily cap** (§5.4) bounds worst-case spend per account:
  150 × ~$0.002 (a maximum-length input) ≈ $0.30/day. Tune it once real usage
  is known.
- **Batch API / flex tier** — about 50% cheaper but not interactive. Right for
  a future "auto-tag my whole stash" backfill job, wrong for any of the four
  buttons.
- **No speculative calls.** Only call on an explicit click. Auto-running on
  every keystroke or drawer open would multiply cost for suggestions nobody
  asked for.

---

## 8. Security

### 8.1 The key

- Read only in `src/lib/openai.ts`, which imports `server-only`, so importing
  it from a client component **fails the build** — the guard `stripe.ts` and
  `r2.ts` rely on.
- Never `NEXT_PUBLIC_`. Never returned in a response or logged.
- One key per environment, in separate OpenAI **projects**, each with its own
  monthly budget (§9). Rotate on any suspicion; it is one Vercel variable.

### 8.2 Input validation

`src/lib/validation/ai.ts`, reusing the existing ceilings rather than new ones:

```ts
export const suggestTagsSchema = z.object({
  title: trimmed().pipe(z.string().max(TITLE_MAX_LENGTH)),
  description: optionalText(DESCRIPTION_MAX_LENGTH, 'Description'),
  content: optionalText(CONTENT_MAX_LENGTH, 'Content'),
  url: optionalText(URL_MAX_LENGTH, 'URL'),
  language: optionalText(LANGUAGE_MAX_LENGTH, 'Language'),
  typeSlug: z.string().max(50),
  currentTags: z.array(z.string().max(TAG_MAX_LENGTH)).max(TAGS_MAX_COUNT),
}).refine((v) => Boolean(v.title || v.content || v.description || v.url), 'Nothing to tag');
```

`typeSlug` only chooses prompt wording and feature availability. It grants
nothing, so a lying client gains nothing. The server should still refuse
explain code for a non-code slug, so the button's gating is not client-only.

### 8.3 Prompt injection

Item content is untrusted text going into a prompt. A snippet can contain
"ignore previous instructions and…". Here the **impact is bounded by design**,
which is the actual defence:

- There are no tools or function calls, so injected text cannot make the model
  *do* anything.
- Output is schema-constrained, then normalized and length-capped on our side.
- Output is shown only to the author of the content that produced it.
- Nothing is applied without an explicit accept, and nothing is written
  without Save.

On top of that, wrap content in clear delimiters, tell the model in the
instructions that it is data to analyze and not instructions, and escape the
delimiter if it appears in the content. At worst, an injected item gets strange
suggestions for its own author.

### 8.4 Output handling

- Re-validate everything the model returns. Structured outputs guarantee
  *shape*, not *content*: a 200-character tag or a markdown summary is still
  schema-valid. That is what `normalize.ts` is for.
- Render markdown only through `MarkdownPreview` (raw HTML disabled). Render
  tags and summaries as plain text.

### 8.5 Data sent to OpenAI

- `store: false` on every call. The Responses API stores responses for 30 days
  by default (SDK doc comment), and nothing here uses `previous_response_id`,
  so there is no reason to keep users' snippets on OpenAI's side.
- `safety_identifier: sha256(userId)` as hex — exactly 64 characters, the
  documented maximum. OpenAI recommends a hash so abuse can be attributed
  without sending identifying data. Never send the email.
- Users' content does go to a third party. Add a line to the privacy policy /
  AI panel copy when one exists. API data is not used for training by default.

### 8.6 `.env.example`

Replace the current two lines with a block in the file's own style:

```bash
# OpenAI, for the Pro AI features (tagging, summaries, code explanations and
# prompt optimization). A project key from platform.openai.com/api-keys — use a
# separate project per environment so each gets its own budget. Unset, the AI
# actions refuse with "AI features are unavailable right now" and the build is
# unaffected.
OPENAI_API_KEY=""
```

---

## 9. Observability and budget

- Log `response.usage` (input, cached, output and reasoning tokens) with the
  feature name for every call. Phase 1 needs real numbers to replace §7.1's
  estimates. `console.info` is enough until Sentry lands; no table.
- Set a **monthly budget and alert** on each OpenAI project. That is the only
  backstop that holds when Upstash fails open, when a cap is mis-set, or when a
  key leaks.
- Treat `insufficient_quota` as an incident, not a user error (§5.2).

---

## 10. Decisions to settle before coding

| #  | Question | Recommendation |
| -- | -------- | -------------- |
| D1 | The homepage says "Tags every item **the moment you save it**", which is automatic. This plan is on-demand suggest-and-accept. | On demand for v1, and change the copy to "Suggests tags for every item". Automatic tagging on save writes AI output the user never reviewed, and pays for items they would not have tagged. |
| D2 | Should free accounts get a small AI allowance (e.g. 5 a month) as a taste? | No — the spec says "no AI" for free. It would also need a monthly counter (Upstash or a column). |
| D3 | Should the AI rate limiter fail open like auth, or fail closed? | **Fail closed** for AI: an Upstash outage costs real money here, not a lockout, and AI is not critical-path. It needs a per-namespace flag in `rate-limit.ts`. |
| D4 | Should explanations be stored? | Not in v1 — regenerating costs about $0.001, and storing needs a migration plus handling of stale explanations. |
| D5 | Stream explanations from day one? | No. Ship non-streaming, measure latency, and add §5.3 only if it feels slow. |
| D6 | Include the user's tag vocabulary in tag prompts (§4.1)? | Yes — about 150 tokens for far better tag reuse. It needs `getTagNames()`. |
| D7 | Limits: 10/min and 150/day, shared across features? | Start there, and revisit after two weeks of `usage` logs. |

---

## 11. Build order, files and tests

### 11.1 Phases

1. **Infrastructure + auto-tag.** `openai` dependency, `src/lib/openai.ts`,
   the `rate-limit.ts` generalization, `src/lib/ai/*`, `suggestTags`, the hook,
   and the tag UI in both forms. Prove the whole pipeline on the smallest
   feature, including one real call to confirm `effort: 'minimal'` on nano.
2. **Summary + prompt optimization.** Two more actions, the same hook, and the
   two review cards.
3. **Explain code.** The id-taking action, the drawer section and, only if
   needed, streaming.

### 11.2 Files

**Create:** `src/lib/openai.ts`, `src/lib/ai/{prompts,schemas,normalize,errors,features,generate}.ts`,
`src/lib/validation/ai.ts`, `src/lib/db/tags.ts`, `src/actions/ai.ts`,
`src/types/ai.ts`, `src/hooks/use-ai-suggestion.ts`,
`src/components/ai/{AiSuggestButton,TagSuggestions,SummarySuggestion,PromptSuggestion,CodeExplanation}.tsx`,
and a co-located `*.test.ts` for every non-component module.

**Modify:** `src/lib/rate-limit.ts` (namespaces and the AI limits),
`src/components/items/ItemEditForm.tsx`, `NewItemDialog.tsx`/`NewItemForm`,
`ItemDrawerBody.tsx`, `ItemDrawerProvider.tsx` (thread `isPro`),
`.env.example`, `package.json`, `src/components/home/content.tsx` (if D1 changes
the copy — `usage-limits.test.ts`-style pinning is not needed for prose).

### 11.3 Tests (Vitest, no network)

Mock `@/lib/ai/generate` in action tests and `openai` itself only in
`generate.test.ts`, following `src/actions/auth.test.ts`. The tests should pin
the decisions that matter:

- **Gates, in order:** no session → no Pro query and no OpenAI call; free →
  `upgradeRequired: true` and **no OpenAI call**; a malformed input → no rate
  limit consumed; rate limited → no OpenAI call.
- **Client:** `getOpenAI` throws with no key and reads it at call time (the
  `stripe.test.ts` pattern), and `timeout` is not the SDK's 10-minute default.
- **Every call** passes `model: AI_MODEL`, `store: false`, a 64-char hex
  `safety_identifier` that is **not** the raw user id, and a
  `max_output_tokens`.
- **`normalizeTags`:** strips `#`, dedupes case-insensitively, prefers the
  user's existing spelling, drops current tags, respects `TAG_MAX_LENGTH`, and
  caps at 5.
- **`build*Input`:** truncates at the stated length and escapes the delimiter.
- **`aiErrorMessage`:** each row of §5.2's table, including
  `insufficient_quota` versus a plain 429, and never echoing the SDK message.
- **Non-throwing failures:** `status: 'incomplete'`, `output_parsed: null`
  (refusal) and an empty tag list each produce the right result.
- **Explain code:** another user's item id reads as not-found.

Mutations worth running (the History precedent): drop the Pro check, swap Pro
and rate-limit order, pass the raw user id as `safety_identifier`, remove
`store: false`, skip truncation, and fail open on Upstash if D3 lands as
fail-closed.

---

## 12. Sources

- OpenAI — GPT-5 nano model page: https://developers.openai.com/api/docs/models/gpt-5-nano
- OpenAI — Structured Outputs guide (`responses.parse`, `zodTextFormat`): https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI — Reasoning guide (effort, reasoning tokens billed as output, `incomplete` handling): https://developers.openai.com/api/docs/guides/reasoning
- OpenAI — Prompt caching guide (1,024-token minimum, prefix ordering): https://developers.openai.com/api/docs/guides/prompt-caching
- OpenAI — Error codes guide: https://developers.openai.com/api/docs/guides/error-codes
- OpenAI — Streaming events (`response.output_text.delta`): https://developers.openai.com/api/reference/resources/responses/streaming-events
- OpenAI Community — "GPT-5-Nano accepted parameters" (effort values per endpoint): https://community.openai.com/t/gpt-5-nano-accepted-parameters/1355086
- LiteLLM issue #27351 (GPT-5.1 nano/mini `none` effort and temperature): https://github.com/BerriAI/litellm/issues/27351
- `openai@7.23.0` installed and probed locally: `client.d.ts` (`timeout`, `maxRetries`),
  `core/error.d.ts` (error classes, `requestID`), `helpers/zod.d.ts` (Zod v3/v4
  support), `resources/responses/responses.d.ts` (`store`, `safety_identifier`,
  `verbosity`, `refusal`), plus a runtime probe of construction without a key.
- This codebase: `src/actions/items.ts`, `src/actions/billing.ts`,
  `src/lib/usage-limits.ts`, `src/lib/pro.ts`, `src/lib/db/billing.ts`,
  `src/lib/rate-limit.ts`, `src/lib/stripe.ts`, `src/hooks/use-upgrade-toast.ts`,
  `src/lib/validation/items.ts`, `src/components/home/content.tsx`,
  `prisma/schema.prisma`.
