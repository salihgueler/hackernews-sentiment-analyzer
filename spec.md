# HackerNews Daily Intelligence Agent — spec.md

## Overview

A CLI agent built with Strands Agents TypeScript SDK that fetches
HackerNews top and best stories daily, analyzes comment sentiment,
and generates a human-readable daily summary report.

## Goals

- Fetch the top 10 and best 10 stories of the day from HackerNews
- Fetch top 20 top-level comments per story
- Run sentiment analysis on comments (positive, negative, neutral
  with confidence percentage)
- Generate a daily markdown summary report
- Run sentiment and summary as parallel subagents for speed

## Non-Goals

- No UI or web interface
- No database or persistent storage
- No real-time or continuous polling
- No authentication or user management
- No historical data comparison
- No deep nested comment fetching — top-level only
- No more than 20 comments per story

## Tech Stack

- Runtime: Node.js with TypeScript
- Agent Framework: Strands Agents TypeScript SDK
- Data Source: HackerNews Firebase public API (direct HTTP)
- Output: Markdown report printed to CLI

## Project Structure

```
hn-agent/
├── src/
│   ├── index.ts          # Entry point
│   ├── agents/
│   │   ├── main.ts       # Main orchestrator agent
│   │   ├── sentiment.ts  # Sentiment subagent
│   │   └── summary.ts    # Summary subagent
│   ├── tools/
│   │   └── hackernews.ts # HN API HTTP calls
│   └── types/
│       └── index.ts      # Shared TypeScript types
├── output/
│   └── report.md         # Generated daily report
├── spec.md               # This file
├── package.json
└── tsconfig.json
```

## Commands

- Install: `npm install`
- Build: `npm run build`
- Run: `npm run start`
- Lint: `npm run lint`

## Agent Architecture

```
main agent
├── fetches top 10 + best 10 HN stories via HTTP
├── sentiment subagent (parallel)
│   └── fetches top 20 comments → analyzes sentiment per story
└── summary subagent (parallel)
    └── receives stories + sentiment → generates report
```

## Code Style

- Use TypeScript strict mode
- Use async/await over raw promises
- Name agents clearly: `mainAgent`, `sentimentAgent`, `summaryAgent`
- All HN API calls go through `src/tools/hackernews.ts` only
- Example type definition:

```typescript
type Story = {
  id: number;
  title: string;
  url: string;
  score: number;
  comments: string[];
  sentiment?: SentimentResult;
};

type SentimentResult = {
  label: "positive" | "negative" | "neutral";
  confidence: number;
};
```

## Acceptance Criteria

- [ ] Running `npm run start` fetches today's top 10 and best 10 HN stories
- [ ] For each story, exactly the top 20 comments are fetched
- [ ] Each story receives a sentiment label and confidence percentage
- [ ] A daily summary report is generated in Markdown format in output/
- [ ] Sentiment and summary subagents run in parallel
- [ ] Full run completes in under 2 minutes
- [ ] Output is readable in the terminal

## Boundaries

|              | Rule                                                   |
| ------------ | ------------------------------------------------------ |
| ✅ Always    | Use TypeScript strict types                            |
| ✅ Always    | Keep all HN API calls inside `src/tools/hackernews.ts` |
| ✅ Always    | Run subagents in parallel, never sequentially          |
| ✅ Always    | Limit comments to top 20 per story                     |
| ⚠️ Ask first | Adding new dependencies to package.json                |
| ⚠️ Ask first | Changing the agent architecture                        |
| ⚠️ Ask first | Modifying the output report format                     |
| 🚫 Never     | Store API keys or secrets in code                      |
| 🚫 Never     | Fetch deeply nested comments                           |
| 🚫 Never     | Make more than 20 concurrent API requests              |

## Constraints

- HackerNews API is public with no official rate limit — keep
  requests reasonable
- Top-level comments only — do not recurse into nested threads
- Story count is fixed: top 10 + best 10, no pagination
- Comments are capped at 20 per story — stop fetching after 20
- Error handling: basic try/catch is sufficient for demo purposes
