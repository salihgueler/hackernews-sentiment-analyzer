/**
 * Tool: fetch the current Hacker News front page stories.
 *
 * The agent uses this tool to decide which stories to drill into for
 * comment sentiment analysis.
 */

import { tool } from "@strands-agents/sdk";
import { z } from "zod";

import { getItems, getTopStoryIds } from "../hn-client.js";
import type { HackerNewsItem, TopStorySummary } from "../types.js";

const inputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(10)
    .describe("Maximum number of front-page stories to return (1-30)."),
});

function toSummary(item: HackerNewsItem): TopStorySummary {
  return {
    id: item.id,
    title: item.title ?? "(untitled)",
    url: item.url ?? null,
    by: item.by ?? null,
    score: item.score ?? 0,
    commentCount: item.descendants ?? 0,
    hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
  };
}

export const getFrontPageStoriesTool = tool({
  name: "get_front_page_stories",
  description:
    "Fetch the current Hacker News front page stories with title, score, comment count, and links. Call this first to see what to analyze.",
  inputSchema,
  callback: async ({ limit }): Promise<TopStorySummary[]> => {
    const allIds = await getTopStoryIds();
    const topIds = allIds.slice(0, limit);
    const items = await getItems(topIds);
    return items
      .filter((item): item is HackerNewsItem => item.type === "story")
      .map(toSummary);
  },
});
