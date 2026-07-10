/**
 * CLI entry point for the Hacker News sentiment analyzer agent.
 *
 * Usage:
 *   npm run dev                                # analyze default top 5 stories
 *   npm run dev -- 10                          # analyze top 10 stories
 *   npm run dev -- "Custom prompt"             # custom instruction
 *   npm run dev -- --out reports/today.md 10   # write report to a file
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentResult, ContentBlock } from "@strands-agents/sdk";

import { createHackerNewsSentimentAgent } from "./agent.js";

interface CliArgs {
  readonly prompt: string;
  readonly outputPath: string;
}

function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  const positional: string[] = [];
  let outputPath: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" || arg === "-o") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error(`Missing value for ${arg}`);
      }
      outputPath = next;
      i += 1;
      continue;
    }
    if (arg !== undefined) {
      positional.push(arg);
    }
  }

  return {
    prompt: buildPrompt(positional),
    outputPath: outputPath ?? defaultOutputPath(),
  };
}

function buildPrompt(args: ReadonlyArray<string>): string {
  if (args.length === 0) {
    return "Analyze the top 5 Hacker News front page stories and produce a sentiment report.";
  }

  const first = args[0];
  if (first !== undefined && /^\d+$/.test(first)) {
    const count = Number.parseInt(first, 10);
    return `Analyze the top ${count} Hacker News front page stories and produce a sentiment report.`;
  }

  return args.join(" ");
}

/**
 * Format `now` as a `YYYY-MM-DD-HHMM` stamp for filenames and fallback slugs.
 */
function timestampStamp(now: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return (
    `${now.getFullYear().toString()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

/**
 * Default output file: reports/hn-sentiment-<YYYY-MM-DD-HHMM>.md
 */
function defaultOutputPath(): string {
  return path.join("reports", `hn-sentiment-${timestampStamp(new Date())}.md`);
}

/**
 * Canonical slug format shared with the portal (`hacker-news-portal`):
 * lowercase ASCII alphanumerics joined by single hyphens, length [1, 80].
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

/**
 * Derive a portal-compatible slug from the output filename stem. Lowercases,
 * collapses any run of non-alphanumerics to a single hyphen, trims stray
 * hyphens, and enforces the length ceiling. Falls back to a timestamp-based
 * slug when the stem cannot yield a valid slug (e.g. all punctuation).
 */
function slugFromOutputPath(outputPath: string): string {
  const stem = path.basename(outputPath).replace(/\.md$/i, "");
  const normalized = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  if (normalized.length > 0 && SLUG_REGEX.test(normalized)) {
    return normalized;
  }
  return `hn-sentiment-${timestampStamp(new Date())}`;
}

/**
 * Extract the plain-text portion of the agent's final message by
 * concatenating every `textBlock` content entry in order.
 */
function extractReportText(result: AgentResult): string {
  const parts: string[] = [];
  for (const block of result.lastMessage
    .content as ReadonlyArray<ContentBlock>) {
    if (block.type === "textBlock") {
      parts.push(block.text);
    }
  }
  return parts.join("\n\n").trim();
}

interface ReportFrontMatter {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly generatedAt: string;
  readonly prompt: string;
}

/**
 * Build a portal-compatible Markdown document: a YAML front-matter block
 * (matching the portal's `ReportFrontMatterSchema`) followed by the report
 * body. Each scalar is emitted via `JSON.stringify`, which produces a valid
 * YAML double-quoted scalar — this safely escapes colons, quotes, and
 * newlines in the prompt/title and forces `generatedAt` to parse as a string
 * (an unquoted ISO timestamp would be coerced to a YAML date).
 */
function buildMarkdownDocument(
  front: ReportFrontMatter,
  report: string,
): string {
  const line = (key: keyof ReportFrontMatter): string =>
    `${key}: ${JSON.stringify(front[key])}`;
  return [
    "---",
    line("id"),
    line("title"),
    line("slug"),
    line("generatedAt"),
    line("prompt"),
    "---",
    "",
    report.trim(),
    "",
  ].join("\n");
}

async function writeReport(
  outputPath: string,
  markdown: string,
): Promise<void> {
  const absolutePath = path.resolve(outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, markdown, "utf8");
}

async function main(): Promise<void> {
  const { prompt, outputPath } = parseArgs(process.argv.slice(2));
  const agent = createHackerNewsSentimentAgent();

  console.log(`\n>>> Prompt: ${prompt}`);
  console.log(`>>> Output: ${outputPath}\n`);

  const result = await agent.invoke(prompt);
  const report = extractReportText(result);

  if (report.length === 0) {
    throw new Error(
      "Agent produced no text content in its final message; nothing to write.",
    );
  }

  const generatedAt = new Date().toISOString();
  const markdown = buildMarkdownDocument(
    {
      id: randomUUID(),
      title: `Hacker News Sentiment Report (${generatedAt.slice(0, 10)})`,
      slug: slugFromOutputPath(outputPath),
      generatedAt,
      prompt,
    },
    report,
  );
  await writeReport(outputPath, markdown);

  console.log(`\n===== Sentiment Report written to ${outputPath} =====\n`);
  console.log(report);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`\nAgent run failed:\n${message}`);
  process.exit(1);
});
