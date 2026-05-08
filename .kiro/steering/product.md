# Product

Hacker News Sentiment Analyzer is a small, spec-driven platform that monitors the Hacker News front page, classifies comment sentiment with an LLM, and publishes Markdown reports through a lightweight web portal.

## What it is

- An autonomous agent pulls the top HN stories, walks each comment tree, and produces a structured sentiment report (per-comment label + confidence, per-story summary, overall "daily brief").
- A web portal lists every historical report in a sidebar, renders the latest report on `/`, and lets visitors trigger a new generation on demand.
- A secondary "title agent" names each report deterministically (short title + kebab-case slug) before it is persisted.

## Surfaces

- `hacker-news-portal/` — React + Vite frontend, the visitor-facing surface.
- `strands-agent-typescript/` — production Strands Agents SDK implementation in TypeScript (primary agent path).
- `vanilla-agent-python/` — reference Python implementation using the raw OpenAI SDK, kept as a comparison point for the talk this repo supports.

## Storage model

- Reports are flat Markdown files with YAML front-matter (`id`, `title`, `slug`, `generatedAt`, `prompt`).
- A generated `index.json` is the single source of truth the frontend consumes; no database.
- The portal copies reports from the agent's `reports/` folder into `public/reports/` at prebuild time so everything ships as static assets.

## Explicit non-goals

- No user accounts, auth, or multi-tenant concerns.
- No database persistence.
- No scheduled/cron generation inside the portal (button-triggered only).
- No token streaming in the UI (polling is enough).
- No automated tests unless the user explicitly asks for them.
