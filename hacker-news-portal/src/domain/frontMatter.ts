/**
 * Pure helpers for the Report YAML front-matter block.
 *
 * - Defines `ReportFrontMatterSchema` (Zod) matching Design → Data Models.
 * - Parses/serializes YAML front-matter with `gray-matter`.
 * - Formats `generatedAt` as an ISO-8601 UTC timestamp.
 * - Strips the leading YAML block from a Markdown body for display.
 *
 * Implements Requirements 8.2, 8.3, 9.1 and realizes Properties 10
 * (parse ∘ serialize round-trip) and 11 (ISO-8601 formatter).
 */

import matter from "gray-matter";
import { z } from "zod";
import { SLUG_REGEX } from "./slug";

/** ISO-8601 UTC timestamp with a trailing `Z` (optional sub-second precision). */
export const IsoUtcTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);

/** Slug string constrained by length [1, 80] and `SLUG_REGEX`. */
export const SlugString = z.string().min(1).max(80).regex(SLUG_REGEX);

/**
 * Canonical schema for the Report YAML front-matter block.
 *
 * `title` may be the empty string; the Portal applies a fallback title in
 * that case (Requirement 4). Every other field MUST be non-empty.
 */
export const ReportFrontMatterSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  slug: SlugString,
  generatedAt: IsoUtcTimestamp,
  prompt: z.string().min(1),
});

export type ReportFrontMatter = z.infer<typeof ReportFrontMatterSchema>;

/**
 * Parse `source` as a Markdown document with YAML front-matter and validate
 * the extracted data against `ReportFrontMatterSchema`. Throws a `ZodError`
 * on any schema violation (including a completely missing front-matter block,
 * in which case `data` will be an empty object and fail the required fields).
 */
export function parseFrontMatter(source: string): {
  data: ReportFrontMatter;
  body: string;
} {
  const parsed = matter(source);
  const data = ReportFrontMatterSchema.parse(parsed.data);
  return { data, body: parsed.content };
}

/**
 * Serialize `data` as a YAML front-matter block followed by `body`.
 *
 * The output begins with `---\n` and closes the block with `\n---\n` so that
 * `parseFrontMatter(serializeFrontMatter(v, body))` round-trips `v` (for
 * well-formed inputs). Uses `gray-matter`'s `stringify` helper, which
 * delegates to `js-yaml` for safe YAML emission.
 */
export function serializeFrontMatter(
  data: ReportFrontMatter,
  body: string,
): string {
  return matter.stringify(body, data);
}

/**
 * Format `date` as an ISO-8601 UTC timestamp that satisfies `IsoUtcTimestamp`
 * and round-trips exactly via `new Date(...)` at millisecond precision.
 * Returns the native `Date#toISOString()` string, which has the form
 * `YYYY-MM-DDTHH:mm:ss.sssZ`.
 */
export function formatGeneratedAt(date: Date): string {
  return date.toISOString();
}

/**
 * Remove a leading YAML front-matter block (if any) from `body` and return
 * the remaining Markdown. The body must begin with `---\n`; otherwise the
 * original string is returned unchanged. Both LF (`\n---\n`) and CRLF
 * (`\n---\r\n`) end delimiters are recognized. One leading newline after the
 * closing delimiter is stripped so the caller receives the Markdown content
 * starting at its first non-empty line.
 *
 * This function never throws on malformed input so the renderer can fall
 * back gracefully.
 */
export function stripFrontMatter(body: string): string {
  if (!body.startsWith("---\n")) {
    return body;
  }
  const searchFrom = 4; // length of opening "---\n"
  let endIdx = body.indexOf("\n---\n", searchFrom);
  let endLen = 5;
  if (endIdx === -1) {
    endIdx = body.indexOf("\n---\r\n", searchFrom);
    endLen = 6;
  }
  if (endIdx === -1) {
    return body;
  }
  const rest = body.slice(endIdx + endLen);
  if (rest.startsWith("\n")) {
    return rest.slice(1);
  }
  if (rest.startsWith("\r\n")) {
    return rest.slice(2);
  }
  return rest;
}
