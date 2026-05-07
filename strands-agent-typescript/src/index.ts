/**
 * CLI entry point for the Hacker News sentiment analyzer agent.
 *
 * Usage:
 *   npm run dev                                # analyze default top 5 stories
 *   npm run dev -- 10                          # analyze top 10 stories
 *   npm run dev -- "Custom prompt"             # custom instruction
 *   npm run dev -- --out reports/today.md 10   # write report to a file
 */

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
 * Default output file: reports/hn-sentiment-<YYYY-MM-DD-HHMM>.md
 */
function defaultOutputPath(): string {
  const now = new Date();
  const pad = (n: number): string => n.toString().padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return path.join("reports", `hn-sentiment-${stamp}.md`);
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

function buildMarkdownDocument(prompt: string, report: string): string {
  const generatedAt = new Date().toISOString();
  return [
    "# Hacker News Sentiment Report",
    "",
    `_Generated: ${generatedAt}_`,
    "",
    `**Prompt:** ${prompt}`,
    "",
    "---",
    "",
    report,
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

  const markdown = buildMarkdownDocument(prompt, report);
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
