import { z } from "zod";

import type { ReportMetadata, ReportPayload } from "./types";
import { ReportMetadataSchema, dataSourceUnavailable, notFound } from "./types";
import { stripFrontMatter } from "../domain/frontMatter";
import { getGenerationCacheToken } from "./generationClient";

// ---------------------------------------------------------------------------
// Browser-only static-read implementation of the `wireBackend` contract.
//
// Reads the prebuild-materialized index (`/reports/index.json`) and each
// Report body (`/reports/<slug>.md`) directly from Vite's static asset
// pipeline. Never imports from `src/generation/`, `scripts/`, or any
// Node-only module (Req 14.3, 17.2).
//
// Performance target (Req 15.1, 15.2): the 500 ms warm-cache budget is
// achieved via two caches:
//   - A module-scoped singleton promise for `index.json`.
//   - A `Map<slug, body>` LRU (capacity 50) for Markdown bodies.
//
// Cache-busting (Req 5.4, 9.3): after a successful Generation Run,
// `generationClient.bumpGenerationCacheToken` advances the token returned
// by `getGenerationCacheToken()`. On every `listReports()` call we
// compare the current token against the token baked into the cached
// promise; a mismatch invalidates the cache before refetching.
//
// Error mapping (Req 12.2, 12.3, 12.6, 12.7):
//   - Network or JSON-parse or schema-validation failure → `DATA_SOURCE_UNAVAILABLE`.
//   - Slug absent from the current index → `NOT_FOUND` (Property 19).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Index cache
// ---------------------------------------------------------------------------

const INDEX_URL = "/reports/index.json";

const ReportIndexSchema = z.array(ReportMetadataSchema);

/**
 * Singleton promise for the most recently requested index fetch. Shared
 * across all concurrent `listReports()` callers during a given token
 * window so the network request is deduplicated.
 */
let cachedIndex: Promise<ReadonlyArray<ReportMetadata>> | null = null;

/**
 * The cache token that was in effect when `cachedIndex` was primed.
 * `null` iff `cachedIndex` is `null`.
 */
let cachedIndexToken: string | null = null;

function buildIndexUrl(token: string): string {
  return token.length > 0
    ? `${INDEX_URL}?v=${encodeURIComponent(token)}`
    : INDEX_URL;
}

async function fetchIndex(
  token: string,
): Promise<ReadonlyArray<ReportMetadata>> {
  let response: Response;
  try {
    response = await fetch(buildIndexUrl(token));
  } catch (networkError) {
    throw dataSourceUnavailable(networkError);
  }

  if (!response.ok) {
    throw dataSourceUnavailable(
      new Error(
        `GET ${INDEX_URL} returned HTTP ${response.status.toString()} ${response.statusText}.`,
      ),
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (parseError) {
    throw dataSourceUnavailable(parseError);
  }

  const parsed = ReportIndexSchema.safeParse(raw);
  if (!parsed.success) {
    throw dataSourceUnavailable(parsed.error);
  }

  // Preserve disk order (Req 12.2); the prebuild script is the source of
  // truth for ordering, so we do not re-sort here.
  return parsed.data;
}

/**
 * Returns the list of `ReportMetadata` entries currently published under
 * `/reports/index.json`, validated against `ReportMetadataSchema`.
 *
 * Caching:
 * - The resolved promise is memoized across calls that share the same
 *   generation cache token.
 * - A token change (triggered by a successful Generation Run) invalidates
 *   the memoized promise; the next call refetches with `?v=<token>` so
 *   any intermediary cache is bypassed.
 */
export function listReports(): Promise<ReadonlyArray<ReportMetadata>> {
  const currentToken = getGenerationCacheToken();

  if (cachedIndex !== null && cachedIndexToken === currentToken) {
    return cachedIndex;
  }

  // Token mismatch (or first-ever call): invalidate and refetch.
  cachedIndex = null;
  cachedIndexToken = null;

  const pending = fetchIndex(currentToken);
  cachedIndex = pending;
  cachedIndexToken = currentToken;
  return pending;
}

// ---------------------------------------------------------------------------
// Body cache (LRU, capacity 50)
// ---------------------------------------------------------------------------

const BODY_CACHE_CAPACITY = 50;

/**
 * LRU cache of stripped Markdown bodies keyed by slug. `Map` iteration
 * order is insertion order, so we implement recency by deleting and
 * re-setting an entry on every hit; the oldest entry is the first key
 * returned by `map.keys()`.
 */
const cachedBodies: Map<string, string> = new Map();

function touchBody(slug: string, body: string): void {
  // If already present, delete so the re-set places it at the tail
  // (most-recent position in insertion order).
  if (cachedBodies.has(slug)) {
    cachedBodies.delete(slug);
  } else if (cachedBodies.size >= BODY_CACHE_CAPACITY) {
    // Evict the least-recently-used entry before inserting a new one.
    const oldestKey = cachedBodies.keys().next().value;
    if (oldestKey !== undefined) {
      cachedBodies.delete(oldestKey);
    }
  }
  cachedBodies.set(slug, body);
}

function readCachedBody(slug: string): string | undefined {
  const body = cachedBodies.get(slug);
  if (body === undefined) {
    return undefined;
  }
  // Move to tail to reflect recent use.
  cachedBodies.delete(slug);
  cachedBodies.set(slug, body);
  return body;
}

async function fetchBody(slug: string): Promise<string> {
  const url = `/reports/${encodeURIComponent(slug)}.md`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    throw dataSourceUnavailable(networkError);
  }

  if (!response.ok) {
    throw dataSourceUnavailable(
      new Error(
        `GET ${url} returned HTTP ${response.status.toString()} ${response.statusText}.`,
      ),
    );
  }

  let text: string;
  try {
    text = await response.text();
  } catch (parseError) {
    throw dataSourceUnavailable(parseError);
  }

  return stripFrontMatter(text);
}

/**
 * Returns the full `ReportPayload` for `slug`.
 *
 * Error mapping:
 * - `slug` not present in `listReports()` output → `NOT_FOUND` (Property 19).
 * - Network or read failure on the body fetch → `DATA_SOURCE_UNAVAILABLE`.
 *
 * The returned `body` has its leading YAML front-matter block stripped via
 * `stripFrontMatter` so the Markdown renderer receives only the content
 * payload.
 */
export async function getReport(slug: string): Promise<ReportPayload> {
  const index = await listReports();
  const metadata = index.find((entry) => entry.slug === slug);
  if (metadata === undefined) {
    throw notFound(slug);
  }

  const cachedBody = readCachedBody(slug);
  if (cachedBody !== undefined) {
    return { metadata, body: cachedBody };
  }

  const body = await fetchBody(slug);
  touchBody(slug, body);
  return { metadata, body };
}

/**
 * Returns just the stripped Markdown body for `slug` using the same LRU
 * cache as `getReport`. Used by callers that have already resolved the
 * `ReportMetadata` elsewhere (e.g. the landing route, which threads the
 * selected metadata through so `ReportView` can skip its own index
 * round-trip).
 *
 * Error mapping:
 * - Network or read failure → `DATA_SOURCE_UNAVAILABLE`.
 *
 * Unlike `getReport` this does NOT verify `slug` against the current
 * index, because the caller has already guaranteed the metadata. A
 * missing file will still surface as `DATA_SOURCE_UNAVAILABLE` from the
 * underlying `fetchBody` call.
 */
export async function getReportBody(slug: string): Promise<string> {
  const cachedBody = readCachedBody(slug);
  if (cachedBody !== undefined) {
    return cachedBody;
  }
  const body = await fetchBody(slug);
  touchBody(slug, body);
  return body;
}

/**
 * Warm the body cache for `slug` without awaiting or throwing.
 *
 * Called from the Sidebar on `onMouseEnter` and `onFocus` so the
 * Markdown body has already been fetched and the LRU entry is populated
 * by the time the Visitor actually navigates.
 *
 * Contract:
 * - Returns immediately (fire-and-forget). Every rejection is swallowed
 *   so a preload failure never bubbles out; the main navigation path
 *   still surfaces `DATA_SOURCE_UNAVAILABLE` via `getReport(slug)` the
 *   usual way.
 * - Skips the network call entirely when the body is already cached.
 * - Shares the same LRU cache as `getReport` / `getReportBody` via
 *   `touchBody`, so a successful preload satisfies a subsequent request
 *   without a second round-trip.
 */
export function preloadReport(slug: string): void {
  if (readCachedBody(slug) !== undefined) {
    return;
  }
  void fetchBody(slug).then(
    (body) => {
      touchBody(slug, body);
    },
    () => {
      // Intentionally swallow: preload is a hint, not a contract. The
      // eventual getReport(slug) call will surface any real error.
    },
  );
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * Clears both the index promise and the Markdown body cache.
 *
 * Consumers (for example the `GenerateReportButton` success path) call
 * this as a belt-and-suspenders complement to the cache token so the next
 * `listReports()` / `getReport(slug)` call re-fetches from the network.
 */
export function invalidateStaticCaches(): void {
  cachedIndex = null;
  cachedIndexToken = null;
  cachedBodies.clear();
}
