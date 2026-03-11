---
inclusion: always
---

# HackerNews Sentiment Analyzer

See @README.md for project overview and @package.json for available commands.

# Tech Stack

- Strands Agents TypeScript SDK (experimental — not production ready)
- HackerNews Firebase public API via direct HTTP calls (not MCP)
- Model provider: Amazon Bedrock
- Output is Markdown written to output/report.md

# Commands

- Build: `npm run build`
- Run: `npm run start`
- Lint: `npm run lint`

# Code Style

- Use ES modules (import/export), not CommonJS (require)
- Use async/await over raw promises
- Use TypeScript strict mode

# Architecture

- Three agents: main, sentiment, summary
- Use "Agents as Tools" pattern — sentiment and summary are wrapped as
  callable functions for the main orchestrator agent
- Sentiment and summary agents MUST run in parallel via Promise.all()
- All HackerNews API calls go through src/tools/hackernews.ts only
- Fetch top 20 comments per story — stop after 20, do not recurse

# Strands Agents Patterns

- TypeScript SDK supports: agent creation, custom tools, MCP integration, lifecycle hooks, and sliding window conversation management
- ALWAYS use Amazon Bedrock models as the model provider (preferable Sonnet 4.5)
- Python-only patterns (DO NOT use): Swarm, Workflow, Graph
- Agent-to-Agent (A2A) is available but not needed for this project

# Boundaries

- NEVER store API keys or secrets in code
- NEVER fetch deeply nested comments
- NEVER run sentiment and summary agents sequentially
- NEVER use Python-only Strands patterns in TypeScript
- Ask before adding new dependencies
- Ask before changing the agent architecture
