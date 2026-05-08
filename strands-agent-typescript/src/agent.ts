/**
 * Hacker News sentiment analyzer agent.
 *
 * Built on the Strands Agents TypeScript SDK with Claude Haiku 4.5 on
 * Amazon Bedrock as the model provider.
 */

import { Agent, BedrockModel } from "@strands-agents/sdk";

import { getFrontPageStoriesTool } from "./tools/get-front-page-stories.js";
import { getStoryCommentsTool } from "./tools/get-story-comments.js";

/**
 * Claude Haiku 4.5 global cross-Region inference profile.
 * See: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html
 */
const CLAUDE_HAIKU_4_5_MODEL_ID =
  "global.anthropic.claude-haiku-4-5-20251001-v1:0";

const DEFAULT_AWS_REGION = "us-east-1";

const SYSTEM_PROMPT = `You are a Hacker News sentiment analyst.

Your job:
1. Call get_front_page_stories to see what's currently on the HN front page.
2. Pick the top stories the user asked about (or the top 5 by default).
3. For each story, call get_story_comments to read the discussion.
4. Analyze the overall mood of each comment thread (positive, negative, mixed, neutral),
   identify recurring themes, notable praise, and notable criticism.
5. Produce a clear, concise Markdown sentiment report at the end.

Report format:
- Start with a short "Overall Front Page Mood" summary (2-3 sentences).
- Then a section per story with:
  - Title (linked to the HN discussion URL)
  - Score and comment count
  - Sentiment label: Positive | Negative | Mixed | Neutral
  - 3-5 bullet themes supported by the comments
  - One representative quote (paraphrase if long, keep under 25 words)
- End with a "Cross-Story Themes" section if you notice patterns across stories.

Rules:
- Never fabricate comments or scores. Only use data returned by tools.
- If a story has no comments, say so and skip sentiment analysis for it.
- Be specific about what commenters are saying, not generic.`;

export interface CreateAgentOptions {
  readonly region?: string;
  readonly modelId?: string;
}

/**
 * Construct a configured Strands agent ready to analyze Hacker News sentiment.
 */
export function createHackerNewsSentimentAgent(
  options: CreateAgentOptions = {},
): Agent {
  const region = options.region ?? process.env.AWS_REGION ?? DEFAULT_AWS_REGION;
  const modelId = options.modelId ?? CLAUDE_HAIKU_4_5_MODEL_ID;

  const model = new BedrockModel({
    region,
    modelId,
    temperature: 0.2,
    maxTokens: 4096,
  });

  return new Agent({
    model,
    tools: [getFrontPageStoriesTool, getStoryCommentsTool],
    systemPrompt: SYSTEM_PROMPT,
  });
}
