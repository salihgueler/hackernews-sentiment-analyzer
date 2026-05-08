/**
 * Slug domain module.
 *
 * Defines the canonical slug regex, the branded `Slug` type, the `isValidSlug`
 * type-guard, and the `resolveSlugCollision` pure function used by the
 * Generation Runner to choose a final slug for a freshly generated Report.
 *
 * Implements Requirements 11.3, 11.4, 11.6, 11.7. Realizes design
 * Properties 17 (slug-regex predicate) and 18 (collision resolution).
 *
 * This module is pure, has no I/O, and is safe to import from both browser
 * and Node code.
 */

/**
 * Canonical slug format: lowercase ASCII letters and digits, joined by
 * single-hyphen separators. No leading, trailing, or consecutive hyphens.
 * Exactly matches Requirement 11.3 and the agent-side contract in the
 * Title Agent's system prompt.
 */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Minimum length for a persisted slug, per Requirement 8.4.
 * A single character is the smallest possible slug that still satisfies
 * `SLUG_REGEX`.
 */
const MIN_SLUG_LENGTH = 1;

/**
 * Maximum length for a persisted slug, per Requirement 8.4.
 * This is the on-disk ceiling; the Title Agent is constrained to the
 * tighter 48-character ceiling from Requirement 11.4.
 */
const MAX_SLUG_LENGTH = 80;

/** Smallest collision suffix explored by `resolveSlugCollision` (Req 11.6). */
const MIN_COLLISION_SUFFIX = 2;

/** Largest collision suffix explored by `resolveSlugCollision` (Req 11.6). */
const MAX_COLLISION_SUFFIX = 999;

/**
 * Branded wrapper around `string`, marking values that have been validated
 * against `SLUG_REGEX` and the [1, 80] length bounds. Consumers that accept
 * a `Slug` may assume the string is well-formed.
 */
export type Slug = string & { readonly __brand: "Slug" };

/**
 * Type-guard that returns `true` iff `value` is a syntactically valid slug
 * (matches `SLUG_REGEX` and has length in `[1, 80]`). On `true`, narrows
 * `value` to the branded `Slug` type.
 */
export function isValidSlug(value: string): value is Slug {
  if (value.length < MIN_SLUG_LENGTH || value.length > MAX_SLUG_LENGTH) {
    return false;
  }
  return SLUG_REGEX.test(value);
}

/**
 * Resolve a slug collision (Requirements 11.6 and 11.7):
 *
 *   - If `base` is not present in `existing`, return `base` unchanged.
 *   - Otherwise, try `base-2`, `base-3`, …, `base-999` in order and return
 *     the first candidate that is not present in `existing`.
 *   - If every suffix in `[-2, -999]` is already present, return `null`.
 *
 * The function is pure: it neither mutates `existing` nor performs I/O.
 * `existing` is compared case-sensitively against the raw slug strings, so
 * callers MUST pass slugs that already satisfy `SLUG_REGEX` (lowercase).
 */
export function resolveSlugCollision(
  base: Slug,
  existing: ReadonlySet<string>,
): Slug | null {
  if (!existing.has(base)) {
    return base;
  }
  for (
    let suffix = MIN_COLLISION_SUFFIX;
    suffix <= MAX_COLLISION_SUFFIX;
    suffix++
  ) {
    const candidate = `${base}-${suffix.toString()}` as Slug;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return null;
}
