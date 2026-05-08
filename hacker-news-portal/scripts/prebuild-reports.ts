/**
 * Prebuild indexer for the Hacker News Portal.
 *
 * Reads every top-level `.md` file in `../strands-agent-typescript/reports/`
 * (relative to `hacker-news-portal/`), validates each file's YAML front-matter
 * with `ReportFrontMatterSchema`, and materializes the results into
 * `public/reports/`:
 *
 *   - `public/reports/index.json` — sorted `ReportMetadata[]` (newest first,
 *     ties broken by ascending case-insensitive slug).
 *   - `public/reports/<slug>.md`  — a byte-identical copy of every valid
 *     source Markdown file, keyed by the validated `slug` from its
 *     front-matter.
 *
 * On any validation failure, duplicate slug, or fs write error the script
 * logs the offending file path(s) to stderr and exits non-zero; no partial
 * index or Markdown file is left behind. The library function
 * `runPrebuildIndexer` throws on failure so `GenerationRunner` (task 10.3)
 * can use it in-process without spawning a child process; the CLI wrapper
 * at the bottom of this file translates thrown errors into a non-zero exit.
 *
 * Implements Requirements 9.1, 9.3, 9.5, 13.1, 13.2, 13.3, 13.6, 13.7, 13.8.
 * Realizes design Properties 13 (filtering + exit rules), 14 (duplicate-slug
 * safety), and 15 (byte-equality copy).
 */

import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ZodError } from "zod";

import {
  parseFrontMatter,
  type ReportFrontMatter,
} from "../src/domain/frontMatter.ts";
import {
  sortReportsForDisplay,
  type ReportMetadata,
} from "../src/domain/reportMetadata.ts";

// ---------------------------------------------------------------------------
// Path resolution.
//
// This script lives at `hacker-news-portal/scripts/prebuild-reports.ts`, so:
//   - `../`    from `scripts/`                → `hacker-news-portal/`
//   - `../../` from `scripts/`                → repository root
//   - source  = `<repo>/strands-agent-typescript/reports`
//   - output  = `<repo>/hacker-news-portal/public/reports`
// ---------------------------------------------------------------------------

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(
  scriptDir,
  "../../strands-agent-typescript/reports",
);
const outDir = path.resolve(scriptDir, "../public/reports");

// ---------------------------------------------------------------------------
// Internal types.
// ---------------------------------------------------------------------------

interface ParseSuccess {
  readonly kind: "ok";
  readonly filePath: string;
  readonly frontMatter: ReportFrontMatter;
  readonly rawContent: string;
}

interface ParseFailure {
  readonly kind: "error";
  readonly filePath: string;
  readonly error: unknown;
}

type ParseResult = ParseSuccess | ParseFailure;

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function hasErrorCode(value: unknown): value is { code: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "string"
  );
}

function describeError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const pathLabel =
          issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${pathLabel}: ${issue.message}`;
      })
      .join("; ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toReportMetadata(front: ReportFrontMatter): ReportMetadata {
  return {
    id: front.id,
    title: front.title,
    slug: front.slug,
    generatedAt: front.generatedAt,
    prompt: front.prompt,
  };
}

/**
 * Return the absolute paths of every top-level `.md` file in `dir`.
 * Throws with a clear message when the directory does not exist.
 */
async function listMarkdownFiles(dir: string): Promise<ReadonlyArray<string>> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    if (hasErrorCode(cause) && cause.code === "ENOENT") {
      throw new Error(
        `Source reports directory does not exist: ${dir}. ` +
          `Expected ../strands-agent-typescript/reports/ relative to hacker-news-portal/.`,
      );
    }
    throw cause;
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

/**
 * Parse `filePath` as Markdown with YAML front-matter and validate against
 * `ReportFrontMatterSchema` (via `parseFrontMatter`). Returns a typed union
 * of success/failure instead of throwing so the caller can report every
 * offending file in one pass.
 */
async function parseReportFile(filePath: string): Promise<ParseResult> {
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    return { kind: "error", filePath, error };
  }
  try {
    const { data } = parseFrontMatter(source);
    return { kind: "ok", filePath, frontMatter: data, rawContent: source };
  } catch (error) {
    return { kind: "error", filePath, error };
  }
}

/**
 * Detect every `slug` shared by two or more files in `successes`.
 * Returns a map from the colliding slug to the list of files that share it.
 * Files are ordered as they appear in `successes`.
 */
function findDuplicateSlugs(
  successes: ReadonlyArray<ParseSuccess>,
): ReadonlyMap<string, ReadonlyArray<string>> {
  const bySlug = new Map<string, string[]>();
  for (const entry of successes) {
    const list = bySlug.get(entry.frontMatter.slug);
    if (list === undefined) {
      bySlug.set(entry.frontMatter.slug, [entry.filePath]);
    } else {
      list.push(entry.filePath);
    }
  }
  const duplicates = new Map<string, ReadonlyArray<string>>();
  for (const [slug, paths] of bySlug) {
    if (paths.length > 1) {
      duplicates.set(slug, paths);
    }
  }
  return duplicates;
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

/**
 * Run the prebuild indexer. Resolves on success; throws on any failure
 * (parse, validation, duplicate slug, fs error). Never leaves a partial
 * `public/reports/` directory behind: on write failure the entire output
 * directory is removed before the throw propagates.
 */
export async function runPrebuildIndexer(): Promise<void> {
  const markdownFiles = await listMarkdownFiles(sourceDir);

  const results = await Promise.all(markdownFiles.map(parseReportFile));

  const failures: ParseFailure[] = [];
  const successes: ParseSuccess[] = [];
  for (const result of results) {
    if (result.kind === "ok") {
      successes.push(result);
    } else {
      failures.push(result);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(
        `[prebuild-reports] Invalid front-matter in ${failure.filePath}: ${describeError(failure.error)}`,
      );
    }
    throw new Error(
      `Prebuild failed: ${failures.length} report file(s) had invalid front-matter.`,
    );
  }

  const duplicates = findDuplicateSlugs(successes);
  if (duplicates.size > 0) {
    for (const [slug, paths] of duplicates) {
      console.error(
        `[prebuild-reports] Duplicate slug "${slug}" across files:`,
      );
      for (const p of paths) {
        console.error(`  - ${p}`);
      }
    }
    throw new Error(
      `Prebuild failed: ${duplicates.size} duplicate slug collision(s) detected.`,
    );
  }

  const metadata = sortReportsForDisplay(
    successes.map((s) => toReportMetadata(s.frontMatter)),
  );

  // Reset the output directory so stale files from removed sources disappear.
  try {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    const indexPath = path.join(outDir, "index.json");
    const indexJson = `${JSON.stringify(metadata, null, 2)}\n`;
    await writeFile(indexPath, indexJson, "utf8");

    for (const entry of successes) {
      const destination = path.join(outDir, `${entry.frontMatter.slug}.md`);
      await copyFile(entry.filePath, destination);
    }
  } catch (error) {
    // Leave no partial output directory behind.
    await rm(outDir, { recursive: true, force: true }).catch(() => {
      /* swallow secondary cleanup errors so the original is surfaced */
    });
    throw error;
  }

  console.log(`Indexed ${successes.length} report(s)`);
}

// ---------------------------------------------------------------------------
// CLI wrapper.
// ---------------------------------------------------------------------------

const entryArg = process.argv[1];
const isMainModule =
  entryArg !== undefined &&
  (import.meta.url === `file://${entryArg}` ||
    entryArg.endsWith("prebuild-reports.ts") ||
    entryArg.endsWith("prebuild-reports.js"));

if (isMainModule) {
  runPrebuildIndexer()
    .then(() => {
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(describeError(error));
      process.exit(1);
    });
}
