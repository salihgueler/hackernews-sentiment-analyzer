/**
 * Shared types for the Hacker News sentiment analyzer agent.
 *
 * These types mirror the shape of the public Hacker News Firebase API
 * (https://github.com/HackerNews/API) and the structured payloads we hand
 * back to the Strands agent via custom tools.
 *
 * Types returned to the agent must be JSON-serializable (no `readonly`
 * modifiers on their outer shape) because the Strands SDK constrains tool
 * return values to `JSONValue`.
 */

export type HackerNewsItemType =
  | "story"
  | "comment"
  | "job"
  | "poll"
  | "pollopt";

export interface HackerNewsItem {
  readonly id: number;
  readonly type: HackerNewsItemType;
  readonly by?: string;
  readonly time?: number;
  readonly text?: string;
  readonly title?: string;
  readonly url?: string;
  readonly score?: number;
  readonly descendants?: number;
  readonly kids?: ReadonlyArray<number>;
  readonly parent?: number;
  readonly deleted?: boolean;
  readonly dead?: boolean;
}

/**
 * Agent-facing summary of a Hacker News front page story. Matches
 * `JSONValue`-compatible shape so it can be returned by a Strands tool.
 */
export interface TopStorySummary {
  [key: string]: string | number | null;
  id: number;
  title: string;
  url: string | null;
  by: string | null;
  score: number;
  commentCount: number;
  hnUrl: string;
}

/**
 * A single Hacker News comment, flattened for the agent.
 */
export interface StoryComment {
  [key: string]: string | number | null;
  id: number;
  by: string | null;
  text: string;
  time: number | null;
}

/**
 * Tool payload returned from `get_story_comments`.
 */
export interface StoryCommentsPayload {
  [key: string]: string | number | StoryComment[];
  storyId: number;
  title: string;
  totalCommentsFetched: number;
  comments: StoryComment[];
}
