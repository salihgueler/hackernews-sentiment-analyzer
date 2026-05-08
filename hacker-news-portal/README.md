# Hacker News Portal

The Hacker News Portal is a React + Vite + TypeScript web frontend that surfaces the sentiment reports produced by the sibling `strands-agent-typescript/` project. Visitors land on the most recent report, browse the archive through a sidebar, navigate between reports via slug-based URLs, and trigger new generations on demand.

Reports are authored as Markdown files with YAML front-matter in `../strands-agent-typescript/reports/`. A prebuild script parses that source folder and materializes it into `public/reports/` so Vite can serve everything as static assets in both dev and production.

## Prerequisites

- Node.js 20+
- `npm install` from inside this folder
- The sibling `../strands-agent-typescript/reports/` folder must exist. It may be empty; the Portal will render an empty-archive state.
- To use the "Generate Report" button in dev or preview, the sibling agent must be built: `cd ../strands-agent-typescript && npm install && npm run build`. The `/__api/generate` middleware dynamically imports `../strands-agent-typescript/dist/agent.js`; if that file is missing the sentiment stage fails with a message telling you to run the build.

## npm scripts

| Script                     | Purpose                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`              | Start the Vite development server with HMR. The `predev` hook runs `prebuild-reports` first, so the dev server never serves a stale index. |
| `npm run build`            | Type-check with `tsc -b` and produce the production bundle in `dist/`. The `prebuild` hook runs `prebuild-reports` first.                  |
| `npm run preview`          | Serve the most recently built `dist/` locally for a final smoke check. Run after `npm run build`.                                          |
| `npm run prebuild-reports` | Run the report indexer on demand. Normally you do not invoke this directly; the `predev` and `prebuild` hooks run it automatically.        |

## What `prebuild-reports` does

The indexer is a Node.js script at `scripts/prebuild-reports.ts`. On every invocation it:

1. Reads every top-level `.md` file in `../strands-agent-typescript/reports/`.
2. Parses each file's YAML front-matter and validates the `id`, `title`, `slug`, `generatedAt`, and `prompt` fields with a Zod schema.
3. Writes `public/reports/index.json`, a manifest of report metadata sorted reverse-chronologically by `generatedAt` (ties broken alphabetically by `slug`).
4. Copies each valid Markdown file into `public/reports/<slug>.md` so it can be fetched directly by the browser.

The script exits with a non-zero status on unparseable YAML, missing required fields, invalid `generatedAt` timestamps, duplicate slugs, or write errors. Because `predev` and `prebuild` are standard npm lifecycle hooks, any such failure stops `npm run dev` and `npm run build` before Vite runs.

The generated `public/reports/` folder is derived output and is gitignored.
