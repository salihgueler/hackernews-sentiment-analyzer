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
 * digits, single-hyphen separators, 1..48 characters, no leading, trailing,
 * or consecutive hyphens).
 */
const SYSTEM_PROMPT = `You propose a concise display title and a URL-safe slug for a Hacker News sentiment report.

Input: the full Markdown body of the report.

Output: RETURN ONLY a single JSON object, with no prose before or after, no markdown code fences, and no comments. The object MUST have exactly these two fields:

  {
    "title": string,  // a human-readable title, 1..80 characters
    "slug":  string   // a URL-safe slug
  }

Slug rules (ALL are mandatory):
  - 1 to 48 characters, inclusive.
  - Only lowercase ASCII letters (a-z), digits (0-9), and the hyphen separator '-'.
  - No leading hyphen, no trailing hyphen, no consecutive hyphens.
  - Must match the regular expression: ^[a-z0-9]+(?:-[a-z0-9]+)*$

Title rules:
  - Plain text, 1 to 80 characters. No surrounding quotes or markdown formatting.

Your entire response MUST be exactly one JSON object matching the shape above and MUST parse with JSON.parse.`;

/**
 * Zod schema for the Title Agent's parsed JSON output.
 *
 * The slug regex is reproduced inline here (rather than imported from
 * `src/domain/slug.ts`) to keep this module standalone and to make the
 * contract with the agent locally inspectable.
 */
export const TitleAgentOutputSchema = z.object({
  title: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(48)
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
 * Invoke the Title Agent for the given report body and return a validated
 * `{ title, slug }` pair.
 *
 * Throws:
 *  - `SyntaxError` (from `JSON.parse`) when the agent's raw output is not
 *    valid JSON.
 *  - `z.ZodError` when the parsed JSON does not satisfy
 *    `TitleAgentOutputSchema`.
 *  - Any error surfaced by the Strands SDK / Bedrock call.
 *
 * The caller (`GenerationRunner`) maps every failure from this function to
 * a `titleValidation` stage failure per Requirement 11.5.
 */
export async function invokeTitleAgent(
  body: string,
): Promise<TitleAgentOutput> {
  const agent = getAgent();
  const result = await agent.invoke(body);
  const raw = extractRawText(result);
  const parsed: unknown = JSON.parse(raw);
  return TitleAgentOutputSchema.parse(parsed);
}
