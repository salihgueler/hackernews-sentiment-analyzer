/**
 * Pure, side-effect-free helpers for Report_Metadata ordering and display.
 *
 * The Sidebar and the Report view both use `displayTitle` and
 * `sortReportsForDisplay` so that index ordering and fallback titles are
 * byte-identical everywhere they appear.
 *
 * Realizes Requirements 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 9.2.
 * Realizes design Properties 1 (ordering) and 6 (fallback title).
 *
 * NOTE: `ReportMetadata` is declared locally in this file to keep this module
 * independent from `src/wireBackend/types.ts`, which is being built in
 * parallel. Later, either this module imports from there, or that module
 * re-exports this shape. The interface is defined by the Report YAML
 * front-matter in the design's Data Models section.
 */

export interface ReportMetadata {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly generatedAt: string;
  readonly prompt: string;
}

/**
 * Return a copy of `metas` sorted for display:
 *   - Primary: `generatedAt` in reverse-chronological order. ISO-8601 UTC
 *     strings with a trailing `Z` sort lexicographically chronologically, so
 *     reversing a direct string compare yields reverse-chronological order
 *     without parsing.
 *   - Tie-break: `slug` in ascending case-insensitive lexicographic order.
 *
 * The input array is not mutated; the returned array is a fresh copy. The
 * sort is stable enough for property-based testing because the tie-breaker is
 * a total order on the lower-cased slug.
 */
export function sortReportsForDisplay(
  metas: ReadonlyArray<ReportMetadata>,
): ReadonlyArray<ReportMetadata> {
  return [...metas].sort((a, b) => {
    if (a.generatedAt !== b.generatedAt) {
      return a.generatedAt < b.generatedAt ? 1 : -1;
    }
    const aSlug = a.slug.toLowerCase();
    const bSlug = b.slug.toLowerCase();
    if (aSlug < bSlug) return -1;
    if (aSlug > bSlug) return 1;
    return 0;
  });
}

/**
 * Derive the display title for a Report, applying the four-branch fallback
 * from Requirements 4.1..4.4 exactly:
 *
 *   1. If `meta.title` has non-whitespace content, return it verbatim.
 *   2. Else if `generatedAt` is empty and `slug` is non-empty, return
 *      `HN Sentiment — {slug}`.
 *   3. Else if `generatedAt` is empty, return `HN Sentiment`.
 *   4. Else examine `siblings` for other entries with the same `generatedAt`
 *      and an empty (after-trim) title. If any exist, disambiguate with the
 *      slug: `HN Sentiment — {generatedAt} ({slug})`. Otherwise return
 *      `HN Sentiment — {generatedAt}`.
 *
 * The em dash (U+2014) is written as a literal character so every render
 * produces the same bytes.
 */
export function displayTitle(
  meta: ReportMetadata,
  siblings: ReadonlyArray<ReportMetadata>,
): string {
  if (meta.title.trim().length > 0) {
    return meta.title;
  }
  if (meta.generatedAt.length === 0 && meta.slug.length > 0) {
    return `HN Sentiment — ${meta.slug}`;
  }
  if (meta.generatedAt.length === 0) {
    return `HN Sentiment`;
  }
  const hasCollidingSibling = siblings.some(
    (s) =>
      s.id !== meta.id &&
      s.title.trim().length === 0 &&
      s.generatedAt === meta.generatedAt,
  );
  if (hasCollidingSibling) {
    return `HN Sentiment — ${meta.generatedAt} (${meta.slug})`;
  }
  return `HN Sentiment — ${meta.generatedAt}`;
}
