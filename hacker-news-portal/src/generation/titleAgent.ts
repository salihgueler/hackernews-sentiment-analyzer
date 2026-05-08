// Node-only module. Must not be imported by browser code (Req 14.3).
/**
 * Title Agent — proposes a `{ title, slug }` pair for a newly produced
 * sentiment report. Implemented with the Strands Agents TypeScript SDK on
 * Claude Haiku 4.5 (Amazon Bedrock) via the global cross-Region inference
 * profile, with no tools.
 *
 * Realizes:
 *  - Requirement 11.1 (non-empty title 1..80, non-empty slug)
 *  - Requirement 11.2 (Zod validation of agent output prior to persistence)
 *  - Requirement 11.3 (slug regex: lowercase ASCII, digits, single hyphens)
 *  - Requirement 11.4 (slug length 1..48)
 *  - Requirement 11.5 (Zod failure ⇒ thrown error, surfaced as
 *    `titleValidation` failure by the GenerationRunner)
 *
 * Security:
 *  - No secrets are read from environment variables by this module.
 *  - AWS credentials resolve from the standard AWS SDK credential chain,
 *    which reads `AWS_REGION` and profile configuration transparently.
 *  - No secret values are ever logged.
 */

import { Agent, BedrockModel } from "@strands-agents/sdk";
import type { AgentResult, ContentBlock } from "@strands-agents/sdk";
import { z } from "zod";

/**
 * Claude Haiku 4.5 global cross-Region inference profile on Amazon Bedrock.
 * See: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html
 */
const CLAUDE_HAIKU_4_5_MODEL_ID =
  "global.anthropic.claude-haiku-4-5-20251001-v1:0";

/**
 * System prompt that pins the agent to a single JSON object response
 * whose `slug` encodes the full slug policy (lowercase ASCII letters and
 * digits, single-hyphen separators, 1..64 characters, no leading, trailing,
 * or consecutive hyphens).
 */
const SYSTEM_PROMPT = `You propose a concise display title and a URL-safe slug for a Hacker News sentiment report.

Input: the full Markdown body of the report.

Output: RETURN ONLY a single JSON object, with no prose before or after, no markdown code fences, and no comments. The object MUST have exactly these two fields:

  {
    "title": string,  // a human-readable title, 1..100 characters
    "slug":  string   // a URL-safe slug
  }

Slug rules (ALL are mandatory):
  - 1 to 64 characters, inclusive.
  - Only lowercase ASCII letters (a-z), digits (0-9), and the hyphen separator '-'.
  - No leading hyphen, no trailing hyphen, no consecutive hyphens.
  - Must match the regular expression: ^[a-z0-9]+(?:-[a-z0-9]+)*$

Title rules:
  - Plain text, 1 to 100 characters. No surrounding quotes or markdown formatting.

Your entire response MUST be exactly one JSON object matching the shape above and MUST parse with JSON.parse.`;

/** Maximum allowed title length, shared by the prompt, the Zod schema, and
 * the one-shot retry truncation step. */
const TITLE_MAX_LENGTH = 100;

/** Maximum allowed slug length, shared by the prompt, the Zod schema, and
 * the one-shot retry truncation step. */
const SLUG_MAX_LENGTH = 64;

/**
 * Zod schema for the Title Agent's parsed JSON output.
 *
 * The slug regex is reproduced inline here (rather than imported from
 * `src/domain/slug.ts`) to keep this module standalone and to make the
 * contract with the agent locally inspectable.
 */
export const TitleAgentOutputSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  slug: z
    .string()
    .min(1)
    .max(SLUG_MAX_LENGTH)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type TitleAgentOutput = z.infer<typeof TitleAgentOutputSchema>;

/**
 * Construct a Strands `Agent` configured for the Title Agent role:
 *  - Bedrock Claude Haiku 4.5 via the global cross-Region inference profile.
 *  - No tools.
 *  - System prompt pins the JSON-only output contract above.
 *
 * Credentials and region are resolved by the AWS SDK credential chain at
 * invocation time; this factory never reads `process.env` directly.
 */
export function createTitleAgent(): Agent {
  const model = new BedrockModel({
    modelId: CLAUDE_HAIKU_4_5_MODEL_ID,
    temperature: 0.2,
    maxTokens: 512,
  });

  return new Agent({
    model,
    tools: [],
    systemPrompt: SYSTEM_PROMPT,
  });
}

/** Module-scoped memoized agent instance for `invokeTitleAgent`. */
let cachedAgent: Agent | null = null;

function getAgent(): Agent {
  if (cachedAgent === null) {
    cachedAgent = createTitleAgent();
  }
  return cachedAgent;
}

/**
 * Concatenate every `textBlock` in the agent's final message, in order.
 * The Title Agent is instructed to return exactly one JSON object as its
 * sole text content; joining with an empty string preserves that text
 * verbatim when the SDK splits it across multiple blocks.
 */
function extractRawText(result: AgentResult): string {
  const parts: string[] = [];
  const blocks: ReadonlyArray<ContentBlock> = result.lastMessage.content;
  for (const block of blocks) {
    if (block.type === "textBlock") {
      parts.push(block.text);
    }
  }
  return parts.join("").trim();
}

/**
 * Defensive fence-stripper. The system prompt instructs the model to
 * return raw JSON with no code fences, but Claude occasionally wraps the
 * object in a ```` ```json … ``` ```` (or plain ```` ``` … ``` ````)
 * block anyway. Strip exactly one outer fenced section when present so
 * `JSON.parse` sees the object directly; otherwise return the input
 * unchanged. Any other malformed payload still fails at `JSON.parse`,
 * which the GenerationRunner surfaces as a `title`-stage failure.
 */
function stripJsonCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  // Match: opening ``` with optional language tag, a newline, the body
  // (non-greedy), an optional trailing newline, and the closing ```.
  const fenced = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/.exec(trimmed);
  if (fenced === null) {
    return trimmed;
  }
  return (fenced[1] ?? "").trim();
}

/**
 * Invoke the Title Agent for the given report body and return a validated
 * `{ title, slug }` pair.
 *
 * A single outer ```` ```json … ``` ```` (or plain triple-backtick) code
 * fence is tolerated before `JSON.parse`; any other deviation from the
 * pinned contract still fails.
 *
 * Retry policy:
 *  - If Zod's only failure is a `too_big` on either `title` or `slug`
 *    (the model ignored the corresponding cap), the agent is re-invoked
 *    exactly once with a targeted follow-up instructing it to shorten
 *    just that field while preserving the other. For `slug`, the
 *    follow-up re-states the slug regex so the retry does not produce a
 *    malformed slug.
 *  - Any other Zod failure (wrong type, missing fields, multi-issue
 *    errors, or a slug regex violation on the first attempt) surfaces
 *    immediately without retry.
 *  - A second validation failure on the retry surfaces as a normal Zod
 *    failure handled by the GenerationRunner's `title`-stage path.
 *
 * Throws:
 *  - `SyntaxError` (from `JSON.parse`) when the agent's raw output is not
 *    valid JSON (after at-most-one fence strip).
 *  - `z.ZodError` when the parsed JSON does not satisfy
 *    `TitleAgentOutputSchema` (including any second-try failure).
 *  - Any error surfaced by the Strands SDK / Bedrock call.
 */
export async function invokeTitleAgent(
  body: string,
): Promise<TitleAgentOutput> {
  const agent = getAgent();
  const firstRaw = stripJsonCodeFence(extractRawText(await agent.invoke(body)));
  const firstParsed: unknown = JSON.parse(firstRaw);
  const firstResult = TitleAgentOutputSchema.safeParse(firstParsed);
  if (firstResult.success) {
    return firstResult.data;
  }

  const retryField = findRetryableTooBigField(firstResult.error, firstParsed);
  if (retryField === null) {
    throw firstResult.error;
  }

  // Narrowed safely by `findRetryableTooBigField`: `firstParsed` is an
  // object with string values at both `title` and `slug`; exactly one of
  // them was rejected as too big, and the other either passed or was not
  // evaluated by Zod because the failure short-circuited the check.
  const candidate = firstParsed as {
    readonly title: string;
    readonly slug: string;
  };
  const followUp = buildRetryPrompt(retryField, candidate);
  const retryRaw = stripJsonCodeFence(
    extractRawText(await agent.invoke(followUp)),
  );
  const retryParsed: unknown = JSON.parse(retryRaw);
  return TitleAgentOutputSchema.parse(retryParsed);
}

type RetryField = "title" | "slug";

/**
 * When the sole Zod failure is `too_big` on `title` or `slug`, return
 * that field name so `invokeTitleAgent` can ask for a shortened value.
 * All other failure shapes return `null` and are not retried.
 *
 * Also sanity-checks that the parsed payload actually has a string
 * value at the rejected field (otherwise there is nothing to quote back
 * on the retry prompt).
 */
function findRetryableTooBigField(
  error: z.ZodError,
  parsed: unknown,
): RetryField | null {
  if (error.issues.length !== 1) {
    return null;
  }
  const [issue] = error.issues;
  if (issue === undefined || issue.code !== "too_big") {
    return null;
  }
  if (issue.path.length !== 1) {
    return null;
  }
  const field = issue.path[0];
  if (field !== "title" && field !== "slug") {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const maybeValue = (parsed as Record<string, unknown>)[field];
  const max = field === "title" ? TITLE_MAX_LENGTH : SLUG_MAX_LENGTH;
  return typeof maybeValue === "string" && maybeValue.length > max
    ? field
    : null;
}

/**
 * Build the follow-up user prompt used by the single retry. The branch
 * for `slug` restates the slug regex so the retry does not produce a
 * malformed value while shortening. Both branches echo the original
 * counterpart field verbatim (via JSON.stringify) so the retry preserves
 * the other field unchanged.
 */
function buildRetryPrompt(
  field: RetryField,
  original: { readonly title: string; readonly slug: string },
): string {
  if (field === "title") {
    const slugLiteral = JSON.stringify(original.slug);
    return [
      `Your previous response returned a title of ${original.title.length} characters, which exceeds the ${TITLE_MAX_LENGTH}-character maximum.`,
      "",
      `Re-emit the SAME JSON object, with the same slug (${slugLiteral}), but shorten the title so it is at most ${TITLE_MAX_LENGTH} characters. Preserve the meaning; do not add ellipses.`,
      "",
      "Return ONLY the corrected JSON object, with no prose, no markdown code fences, and no comments.",
      "",
      "Original title (for reference):",
      JSON.stringify(original.title),
    ].join("\n");
  }
  const titleLiteral = JSON.stringify(original.title);
  return [
    `Your previous response returned a slug of ${original.slug.length} characters, which exceeds the ${SLUG_MAX_LENGTH}-character maximum.`,
    "",
    `Re-emit the SAME JSON object, with the same title (${titleLiteral}), but shorten the slug so it is at most ${SLUG_MAX_LENGTH} characters.`,
    "",
    "Slug rules (ALL still apply):",
    "  - Only lowercase ASCII letters (a-z), digits (0-9), and single hyphens.",
    "  - No leading hyphen, no trailing hyphen, no consecutive hyphens.",
    "  - Must match ^[a-z0-9]+(?:-[a-z0-9]+)*$",
    "",
    "Return ONLY the corrected JSON object, with no prose, no markdown code fences, and no comments.",
    "",
    "Original slug (for reference):",
    JSON.stringify(original.slug),
  ].join("\n");
}
