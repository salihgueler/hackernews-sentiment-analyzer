# Hackernews Sentiment Analyzer Platform Portal — Spec

> Spec-driven contract for evolving the Hacker News sentiment analyzer into a
> small web app. This document is the source of truth; tasks will be generated
> separately by Kiro from this file.

## 1. Context

The repository already contains a working Strands-based Hacker News sentiment
analyzer that writes Markdown reports to a local `reports/` folder. This spec
adds a web frontend that displays the latest report and lets visitors browse
older ones, a second Strands agent that names each report, and a scheduled /
on-demand generation path. The work supports a talk on moving from vibe coding
to spec-driven development, so the boundary between _what_ and _how_ is drawn
deliberately.

## 2. Goals

- Ship a web frontend that lists every report and renders the selected one.
- Reuse the existing sentiment agent unchanged.
- Add a second Strands agent (title agent) that proposes a short report title.
- Trigger the report generation with a button click
- Make the first deliverable a frontend-only slice that reads real reports from
  the repository's `reports/` folder through a data layer.

## 3. Non-goals

- User accounts, authentication, multi-tenant concerns.
- Database persistence. Flat Markdown plus a small `index.json` are the store.
- cron job to generate report
- Token streaming in the UI. Polling is enough.
- Unit or integration tests in this scope (steering rule: tests only on
  explicit request).
- Full-text search across reports.

## 4. Delivery phases

### Phase 1 — Preparing the project

- Create `hacker-news-portal` folder to keep the project
- Creating the web project

### Phase 2 - Frontend slice with reading reports from agent project

- A `wireBackend` module exposing the same interface the real backend will
  expose, reading the existing Markdown files and a generated `index.json`.
- Reports are served as static assets during Vite dev and build. A small
  pre-build script parses the Markdown front-matter and emits
  `public/reports/index.json`, then copies the Markdown files into
  `public/reports/`.
- The "Generate report" button is present and wired to trigger the agent to generate a new report

## 5. Requirements

### 5.1 User stories (EARS)

- **US-1 [P1]** WHEN a visitor opens `/`, THE SYSTEM SHALL render the most
  recent sentiment report in full.
- **US-2 [P1]** WHEN a visitor opens `/`, THE SYSTEM SHALL show a sidebar
  listing every past report, newest first, with its title and generation date.
- **US-3 [P1]** WHEN a visitor clicks a sidebar entry, THE SYSTEM SHALL
  navigate to `/reports/:slug` and render that report without a full page
  reload.
- **US-4 [P1]** WHEN a report has no title in its front-matter, THE SYSTEM
  SHALL fall back to a deterministic display name of the form
  `HN Sentiment — <generatedAt>`.
- **US-5** WHEN a visitor clicks "Generate report", THE SYSTEM SHALL start a
  new run, disable the button, show progress, and navigate to the produced
  report when done.
- **US-6** WHEN a generation is already in flight, THE SYSTEM SHALL reject
  new generate requests and inform the caller with a structured error code.
- **US-7** WHEN a generation run fails, THE SYSTEM SHALL log the failure,
  keep previous reports intact, and surface a user-friendly error.

### 5.2 Functional

- **F-1 [P1]** Reports are Markdown files with YAML front-matter carrying
  `id`, `title`, `slug`, `generatedAt` (ISO-8601 UTC), and `prompt`.
- **F-2 [P1]** A `reports/index.json` file lists every report's metadata in
  reverse-chronological order. It is the single source of truth the frontend
  consumes.
- **F-3 [P1]** The frontend renders Markdown through a safe pipeline (GFM
  tables, code, autolinks). Raw HTML is not executed.
- **F-4 [P1]** Sidebar entries are keyboard-accessible: focusable, activated
  by Enter or Space, and the URL updates on navigation.
- **F-5** The backend exposes the endpoints defined in §10.4.
- **F-6** The title agent produces `{ title, slug }` validated by a Zod
  schema. `slug` is lowercase kebab-case, ASCII only, ≤ 48 characters.
- **F-7** Duplicate slugs receive a `-2`, `-3`, … suffix before persistence.

### 5.3 Non-functional

- **NF-1** Strict TypeScript everywhere. `strict: true`, `noImplicitAny`,
  `noUnusedLocals`, `noUnusedParameters`. The `any` type is forbidden per the
  workspace steering rule.
- **NF-2** The landing page and latest report render under 500 ms on a warm
  local dev cache.
- **NF-3** Accessibility: the sidebar is a `<nav>` with an `aria-label`,
  entries are real anchors, the active entry uses `aria-current="page"`,
  color contrast meets WCAG 2.1 AA, and `prefers-reduced-motion` is respected.
