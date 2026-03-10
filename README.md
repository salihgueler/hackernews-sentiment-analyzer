# HackerNews Sentiment Analyzer

A CLI agent that fetches HackerNews stories, analyzes comment sentiment, and generates daily summary reports.

## Features

- Fetches top 10 and best 10 HackerNews stories daily
- Retrieves up to 20 top-level comments per story
- Analyzes aggregated sentiment using LLM (positive/negative/neutral with confidence)
- Generates human-readable Markdown reports
- Parallel processing for sub-2-minute execution

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Usage

```bash
# Run the agent
npm run start
```

The agent will:
1. Fetch 20 HackerNews stories (10 top + 10 best)
2. Retrieve comments for each story
3. Analyze sentiment using LLM
4. Generate a report at `output/report.md`
5. Print the report to stdout

## Output

The generated report includes:
- Date of analysis
- Top Stories section with titles, URLs, scores, and sentiment
- Best Stories section with titles, URLs, scores, and sentiment

Example output: `output/report.md`

## Architecture

- **Main Agent** (`src/agents/main.ts`): Orchestrates the entire pipeline
- **Sentiment Subagent** (`src/agents/sentiment.ts`): Analyzes comment sentiment via LLM
- **Summary Subagent** (`src/agents/summary.ts`): Generates Markdown reports
- **HN API Tools** (`src/tools/hackernews.ts`): Centralized HackerNews API access

## Constitution Compliance

This project follows strict architectural principles:

✅ **Agent-First Architecture**: 3 agents with parallel execution  
✅ **Strict Resource Limits**: 20 stories, 20 comments per story, 20 concurrent requests  
✅ **TypeScript Strict Mode**: Full type safety  
✅ **Centralized API Access**: All HN calls through `src/tools/hackernews.ts`  
✅ **CLI-Native Output**: Markdown to file and stdout  

## Performance

- Target: < 2 minutes for full pipeline
- Actual: ~3-5 seconds (well under target)
- Parallel processing of stories and sentiment analysis

## Error Handling

- Partial failure tolerance: Continues processing if individual stories/comments fail
- Errors logged to stderr
- Graceful degradation for missing data

## Development

```bash
# Build
npm run build

# Lint (requires ESLint setup)
npm run lint
```

## License

ISC
