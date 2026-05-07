/**
 * Minimal, typed client for the public Hacker News Firebase API.
 *
 * Docs: https://github.com/HackerNews/API
 */

import type { HackerNewsItem } from "./types.js";

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

/**
 * Fetches and parses a JSON payload from the Hacker News API, validating
 * the HTTP status and constraining the parsed result to the expected type.
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Hacker News API request failed (${response.status} ${response.statusText}): ${url}`,
    );
  }
  const payload = (await response.json()) as T;
  return payload;
}

/**
 * Returns the list of item IDs currently on the Hacker News front page,
 * ordered from highest to lowest rank.
 */
export async function getTopStoryIds(): Promise<ReadonlyArray<number>> {
  return fetchJson<ReadonlyArray<number>>(`${HN_API_BASE}/topstories.json`);
}

/**
 * Fetches a single Hacker News item (story, comment, job, etc.) by id.
 * Returns null when the API returns a null payload (deleted/missing item).
 */
export async function getItem(itemId: number): Promise<HackerNewsItem | null> {
  const item = await fetchJson<HackerNewsItem | null>(
    `${HN_API_BASE}/item/${itemId}.json`,
  );
  return item;
}

/**
 * Fetches multiple items in parallel, preserving input order and filtering
 * out null/deleted/dead items.
 */
export async function getItems(
  itemIds: ReadonlyArray<number>,
): Promise<ReadonlyArray<HackerNewsItem>> {
  const items = await Promise.all(itemIds.map((id) => getItem(id)));
  return items.filter(
    (item): item is HackerNewsItem =>
      item !== null && item.deleted !== true && item.dead !== true,
  );
}
