# Quickstart: HackerNews Daily Intelligence Agent

**Date**: 2026-03-10  
**Feature**: 001-hn-sentiment-analyzer

## Prerequisites

- Node.js LTS (v18 or higher)
- npm or yarn
- Git

## Installation

```bash
# Clone repository
git clone <repo-url>
cd hackernews-sentiment-analyzer

# Checkout feature branch
git checkout 001-hn-sentiment-analyzer

# Install dependencies
npm install
```

## Project Structure

```
src/
├── index.ts          # Entry point
├── agents/
│   ├── main.ts       # Main orchestrator
│   ├── sentiment.ts  # Sentiment analysis
│   └── summary.ts    # Report generation
├── tools/
│   └── hackernews.ts # HN API calls
└── types/
    └── index.ts      # TypeScript types

output/
└── report.md         # Generated report (created at runtime)
```

## Usage

### Run the Agent

```bash
# Build TypeScript
npm run build

# Run the agent
npm run start
```

**Expected Output**:
- Progress messages to stdout
- Errors (if any) to stderr
- Final Markdown report printed to stdout
- Report saved to `output/report.md`

**Runtime**: Should complete in under 2 minutes

### View the Report

```bash
# View in terminal
cat output/report.md

# Or open in editor
code output/report.md
```

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npx tsc --noEmit
```

## Configuration

No configuration required. The agent uses:
- HackerNews public API (no auth)
- Strands Agents SDK (built-in LLM access)
- Fixed limits: 20 stories, 20 comments per story, 20 concurrent requests

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
npm run build
```

### API timeout or rate limit errors
- Check internet connection
- HackerNews API may be temporarily unavailable
- Agent will log errors to stderr and continue with partial results

### Empty report
- Check stderr for API errors
- Verify HackerNews API is accessible: `curl https://hacker-news.firebaseio.com/v0/topstories.json`

### Performance issues (>2 minutes)
- Check network latency
- Verify parallel subagent execution (not sequential)
- Review stderr for excessive retries

## Architecture

```
Main Agent
├── Fetches 10 top + 10 best stories
├── Spawns Sentiment Subagent (parallel)
│   └── Analyzes comments via LLM
└── Spawns Summary Subagent (parallel)
    └── Generates Markdown report
```

## Output Format

```markdown
# HackerNews Daily Intelligence Report
**Date**: 2026-03-10

## Top Stories
1. [Story Title](url) - Score: 123 - Sentiment: positive (85%)
...

## Best Stories
1. [Story Title](url) - Score: 456 - Sentiment: No sentiment
...
```

## Next Steps

After successful run:
1. Review `output/report.md`
2. Check constitution compliance (`.specify/memory/constitution.md`)
3. Proceed to task breakdown (`/speckit.tasks`)
