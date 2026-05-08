# Tech

## Stack overview

The workspace is a pnpm-free, npm-based multi-root repo with three siblings. Keep changes scoped to the folder that owns the concern.

### `hacker-news-portal/` — web frontend

- **Framework**: React 19 + Vite 8, TypeScript (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **Compiler**: React Compiler enabled via `@vitejs/plugin-react` v6's `reactCompilerPreset`, fed through `@rolldown/plugin-babel`. Manual `useMemo` / `useCallback` stay correct; the compiler augments them.
- **Routing**: `react-router-dom` v7.
- **Markdown**: `react-markdown` + `remark-gfm` + `rehype-sanitize` + `rehype-highlight`. Raw HTML is never executed.
- **Validation**: `zod` v4 for every parsed payload (front-matter, agent outputs, API responses).
- **UI**: custom token-driven CSS in `src/styles/tokens.css`, self-hosted fonts via `@fontsource-variable/*` (Fraunces / Inter Tight / JetBrains Mono, upright-axis only), plus small in-house primitives (`Button`, `Skeleton`, `Chip`, `SectionLabel`). Icons from `lucide-react` via top-level named imports only.
- **Local API**: `plugins/generation-plugin.ts` is a Vite middleware that exposes `/__api/generate` in dev and preview; it dynamically imports the sibling agent's built output.

### `strands-agent-typescript/` — primary agent

- **SDK**: `@strands-agents/sdk` with `BedrockModel`.
- **Model**: Claude Haiku 4.5 on Amazon Bedrock via the global cross-Region inference profile ID `global.anthropic.claude-haiku-4-5-20251001-v1:0`. Do not substitute.
- **Credentials**: default AWS credential chain only. Never read secrets from `process.env`, never hardcode client IDs / keys / resource IDs.
- **Schemas**: co-located `zod` schemas for every structured agent output; `safeParse` first, then a single targeted retry with `parse`.
- **Patterns**: exported factory + module-scoped memoized `getAgent()`; JSON-only system prompts; defensive single-fence strip before `JSON.parse`; text extraction concatenates every `textBlock` in `result.lastMessage.content`.

### `vanilla-agent-python/` — reference implementation

- **Runtime**: Python 3.10+, `httpx` (async), `openai`, `pydantic` v2, `rich`, `tenacity`.
- **Role**: comparison baseline for the spec-driven talk; not on the portal's hot path.

## Cross-cutting rules

- **Testing**: do NOT write unit or integration tests unless the user explicitly asks. This applies to every surface.
- **New Markdown files**: do NOT create new `.md` files (changelogs, docs, plans) unless the user explicitly asks. Update the existing `README.md` for the affected surface when the public API or architecture changes.
- **Type safety**: `any` is forbidden. Narrow with guards (`if (x === undefined)`) rather than widening with `as`.
- **Commits**: group by a single logical purpose, keep under ~150 lines of source. Append `(Kiro)` to the author: `git commit --author="[User] (Kiro) <[email]>"`. Summary line, blank line, ≤20-line body describing what changed and what was verified.

## Common commands

### Portal (`hacker-news-portal/`)

| Command                    | Purpose                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm install`              | Install deps.                                                                                        |
| `npm run dev`              | Vite dev server. `predev` hook runs `prebuild-reports` first so the index is never stale.            |
| `npm run build`            | `tsc -b` type-check then `vite build` into `dist/`. `prebuild` hook runs `prebuild-reports` first.   |
| `npm run preview`          | Serve the built `dist/` locally.                                                                     |
| `npm run prebuild-reports` | Run `scripts/prebuild-reports.ts` on demand to rebuild `public/reports/index.json` and copy sources. |
| `npm run lint`             | ESLint (flat config).                                                                                |

- Long-running (`npm run dev`, `npm run preview`): ask the user to run these manually; do not invoke from a bash tool.
- The Generate button needs the sibling agent built: `cd ../strands-agent-typescript && npm install && npm run build` so the middleware can dynamic-import `dist/agent.js`.

### Strands agent (`strands-agent-typescript/`)

| Command         | Purpose                             |
| --------------- | ----------------------------------- |
| `npm install`   | Install deps.                       |
| `npm run build` | `tsc` into `dist/`.                 |
| `npm run dev`   | `tsx src/index.ts` for a local run. |
| `npm start`     | Run the built `dist/index.js`.      |

### Python agent (`vanilla-agent-python/`)

| Command                                              | Purpose                                             |
| ---------------------------------------------------- | --------------------------------------------------- |
| `python3 -m venv .venv && source .venv/bin/activate` | Create / activate a local venv.                     |
| `pip install -r requirements.txt`                    | Install deps.                                       |
| `pip install -e .`                                   | Install the CLI entrypoint `hn-sentiment` on PATH.  |
| `hn-sentiment` / `python -m hn_sentiment.cli`        | Run the agent. Requires `OPENAI_API_KEY` in `.env`. |
