/**
 * CLI entry point for the Hacker News sentiment analyzer agent.
 *
 * Usage:
 *   npm run dev              # analyze default top 5 stories
 *   npm run dev -- 10        # analyze top 10 stories
 *   npm run dev -- "Summarize HN sentiment about the latest AI stories"
 */

import { createHackerNewsSentimentAgent } from "./agent.js";

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

async function main(): Promise<void> {
  const prompt = buildPrompt(process.argv.slice(2));
  const agent = createHackerNewsSentimentAgent();

  console.log(`\n>>> Prompt: ${prompt}\n`);
  const result = await agent.invoke(prompt);

  console.log("\n===== Sentiment Report =====\n");
  console.log(result.lastMessage);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`\nAgent run failed:\n${message}`);
  process.exit(1);
});
