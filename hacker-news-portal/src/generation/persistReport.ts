// Node-only module. Must not be imported by browser code (Req 14.3).
/**
 * Report persistence — writes a newly generated sentiment report to the
 * authoritative `strands-agent-typescript/reports/` folder and mints the
 * collision-resistant identifiers used by the pipeline.
 *
 * Realizes:
 *  - Requirement 8.1 (unique filename inside the source reports folder)
 *  - Requirement 8.2 (YAML front-matter block as the first content)
 *  - Requirement 8.3 (ISO-8601 UTC `generatedAt` timestamp — re-exported)
 *  - Requirement 8.5 (unique `id` across all persisted reports)
 *  - Requirement 8.6 (no partial file on persistence failure)
 *
 * Design cross-references:
 *  - Components §3 (persist stage of the GenerationRunner)
 *  - Components §10–§11
 *  - Data Models → Report YAML Front-Matter
 *  - Realizes Properties 10 (round-trip), 11 (ISO-8601), 12 (unique id)
 */

import { randomBytes } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serializeFrontMatter } from "../domain/frontMatter";

// Re-export so callers can use a single import site. Keeping a single source
// of truth in `../domain/frontMatter` matches the design's "pure helpers"
// module layout (Components §11).
export { formatGeneratedAt } from "../domain/frontMatter";

/**
 * Crockford's Base32 alphabet, excluding the ambiguous characters `I`, `L`,
 * `O`, and `U`. This is the ULID-standard alphabet.
 * See: https://www.crockford.com/base32.html and the ULID specification
 * (https://github.com/ulid/spec) for the same 32-character ordering.
 */
const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Encode a 48-bit unsigned millisecond timestamp as exactly 10 Crockford
 * Base32 characters. 10 chars × 5 bits = 50 bits; the top 2 bits are always
 * zero for any timestamp in the range [0, 2^48 − 1], which covers every
 * instant up to year 10889 AD. JavaScript numbers safely represent all
 * integers through 2^53 − 1, so arithmetic here is exact.
 */
function encodeTimestampBase32(ms: number): string {
  let value = ms;
  const out: string[] = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    const idx = value % 32;
    out[i] = CROCKFORD_BASE32.charAt(idx);
    value = Math.floor(value / 32);
  }
  return out.join("");
}

/**
 * Encode exactly 10 bytes (80 bits) of entropy as 16 Crockford Base32
 * characters. 16 chars × 5 bits = 80 bits, so the encoding is a bijection on
 * the input space and the full entropy is preserved. Bits are consumed
 * MSB-first via a single 80-bit `BigInt` accumulator.
 */
function encodeRandomBase32(bytes: Uint8Array): string {
  if (bytes.length !== 10) {
    throw new Error(
      `encodeRandomBase32: expected 10 bytes, received ${bytes.length}`,
    );
  }
  let value = 0n;
  for (let i = 0; i < 10; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  const out: string[] = new Array<string>(16);
  for (let i = 15; i >= 0; i--) {
    const idx = Number(value & 31n);
    out[i] = CROCKFORD_BASE32.charAt(idx);
    value = value >> 5n;
  }
  return out.join("");
}

/**
 * Produce a ULID-style, lexicographically sortable, collision-resistant
 * report identifier: a 26-character Crockford Base32 string formed by
 * concatenating a 10-character 48-bit millisecond timestamp prefix with a
 * 16-character encoding of 80 bits of cryptographic randomness from
 * `node:crypto`.
 *
 * With 80 bits of entropy per call, any sequence of 10,000 calls yields
 * 10,000 pairwise-distinct strings with overwhelming probability: the
 * collision probability for 10,000 ids drawn uniformly from a 2^80 space is
 * ≈ 4.1 × 10^−17 (birthday approximation). The millisecond timestamp prefix
 * provides monotonic ordering between calls that fall in different
 * milliseconds.
 */
export function newReportId(): string {
  const timePart = encodeTimestampBase32(Date.now());
  const randomPart = encodeRandomBase32(randomBytes(10));
  return `${timePart}${randomPart}`;
}

/**
 * Absolute path of the authoritative reports folder, resolved once at module
 * load relative to this source file. Layout:
 *
 *   hacker-news-portal/src/generation/persistReport.ts   (this file)
 *   strands-agent-typescript/reports/                    (target)
 *
 * From `src/generation/` we walk three levels up to reach the repository
 * root, then descend into `strands-agent-typescript/reports`.
 */
const THIS_FILE = fileURLToPath(import.meta.url);
const REPORTS_DIR = path.resolve(
  path.dirname(THIS_FILE),
  "../../../strands-agent-typescript/reports",
);

/** Arguments for `persistReport`; mirrors `ReportFrontMatter` plus the body. */
export interface PersistReportArgs {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly generatedAt: string;
  readonly prompt: string;
  readonly body: string;
}

/**
 * Serialize `args` into a Markdown-with-front-matter document and atomically
 * write it to `<REPORTS_DIR>/<slug>.md`. The write uses the `"wx"` open flag
 * so an existing file at the same path causes the call to reject (a new
 * `EEXIST` error), preserving Requirement 8.1's uniqueness guarantee and
 * Requirement 8.6's no-partial-file guarantee.
 *
 * Returns the absolute filesystem path of the newly created file on success.
 *
 * On any error during the write, a best-effort `unlink` removes any partial
 * file that may have been created, then the original error is re-thrown so
 * the caller (GenerationRunner) can surface it at the `persist` stage.
 *
 * Defense in depth: the resolved target is checked to remain inside
 * `REPORTS_DIR`. Upstream validation already constrains slugs to
 * `^[a-z0-9]+(?:-[a-z0-9]+)*$` (no `.`, `/`, or `..`), but a redundant guard
 * here prevents any future code path from escaping the reports folder.
 */
export async function persistReport(args: PersistReportArgs): Promise<string> {
  const target = path.join(REPORTS_DIR, `${args.slug}.md`);
  const resolvedTarget = path.resolve(target);
  const reportsDirWithSep = REPORTS_DIR.endsWith(path.sep)
    ? REPORTS_DIR
    : `${REPORTS_DIR}${path.sep}`;

  if (!resolvedTarget.startsWith(reportsDirWithSep)) {
    throw new Error(
      `persistReport: refusing to write outside reports directory: ${resolvedTarget}`,
    );
  }

  const contents = serializeFrontMatter(
    {
      id: args.id,
      title: args.title,
      slug: args.slug,
      generatedAt: args.generatedAt,
      prompt: args.prompt,
    },
    args.body,
  );

  try {
    await writeFile(resolvedTarget, contents, { flag: "wx" });
    return resolvedTarget;
  } catch (error) {
    // Best-effort cleanup. `unlink` is a no-op error-wise if the file was
    // never created (e.g., EEXIST collision) thanks to the `.catch(() => {})`.
    await unlink(resolvedTarget).catch(() => {});
    throw error;
  }
}
