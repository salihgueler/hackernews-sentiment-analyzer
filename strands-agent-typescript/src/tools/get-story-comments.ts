/**
 * Tool: fetch top-level comments for a given Hacker News story.
 *
 * The agent calls this once per story it wants to analyze. We intentionally
 * only return top-level comments to keep the prompt size predictable, and
 * we strip HTML to feed the model clean text.
 */

import { tool } from "@strands-agents/sdk";
import { z } from "zod";

import { getItem, getItems } from "../hn-client.js";
import type {
  HackerNewsItem,
  StoryComment,
  StoryCommentsPayload,
} from "../types.js";

const inputSchema = z.object({
  storyId: z
    .number()
    .int()
    .positive()
    .describe("The Hacker News story id to fetch comments for."),
  maxComments: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Maximum number of top-level comments to retrieve (1-50)."),
});

/**
 * Strip the subset of HTML that Hacker News embeds in comment bodies
 * (paragraph breaks, anchor tags, and named entities) so the model sees
 * plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<p>/gi, "\n\n")
    .replace(/<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*>/gi, "")
    .replace(/<\/a>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function toComment(item: HackerNewsItem): StoryComment {
  return {
    id: item.id,
    by: item.by ?? null,
    text: stripHtml(item.text ?? ""),
    time: item.time ?? null,
  };
}

export const getStoryCommentsTool = tool({
  name: "get_story_comments",
  description:
    "Fetch top-level comments for a specific Hacker News story. Returns plain-text comment bodies the agent can analyze for sentiment.",
  inputSchema,
  callback: async ({ storyId, maxComments }): Promise<StoryCommentsPayload> => {
    const story = await getItem(storyId);
    if (story === null) {
      throw new Error(`Hacker News story ${storyId} not found.`);
    }
    if (story.type !== "story") {
      throw new Error(
        `Hacker News item ${storyId} is a ${story.type}, not a story.`,
      );
    }

    const kidIds = (story.kids ?? []).slice(0, maxComments);
    const rawComments = await getItems(kidIds);
    const comments = rawComments
      .filter((item): item is HackerNewsItem => item.type === "comment")
      .map(toComment)
      .filter((comment: StoryComment) => comment.text.length > 0);

    return {
      storyId: story.id,
      title: story.title ?? "(untitled)",
      totalCommentsFetched: comments.length,
      comments,
    };
  },
});
