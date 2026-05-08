# Hacker News Sentiment Analyzer

A small, spec-driven platform that monitors the Hacker News front page, classifies comment sentiment with an LLM, and publishes Markdown reports through a lightweight web portal. The repo doubles as the working example for a talk on moving from vibe coding to spec-driven development, which is why the boundary between _what_ (specs) and _how_ (code) is drawn deliberately.

## Repository layout

```
hackernews-sentiment-analyzer/
├── .agents/skills/            # Portable agent skills (authoring Strands, frontend design, React)
├── .kiro/
│   ├── specs/                 # Spec-driven feature folders (requirements, design, tasks)
│   └── steering/              # product.md, tech.md, structure.md
├── hacker-news-portal/        # React + Vite frontend (visitor-facing surface)
├── strands-agent-typescript/  # Primary Strands Agents SDK implementation (TypeScript)
├── vanilla-agent-python/      # Reference Python implementation (OpenAI SDK)
├── hackernews-platform-spec.md
├── feedback-and-facelift-plan.md
└── themes-agent-plan.md
```

Each sibling package owns its own `package.json` / `pyproject.toml` and its own install/build lifecycle. There is no root workspace manifest — the packages stay independent.

## Surfaces

| Package                     | Role                                                                                                       | Stack                                                                    | Entry                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `hacker-news-portal/`       | Visitor-facing web app: landing view, sidebar archive, on-demand generation.                               | React 19 + Vite 8 + TypeScript (strict), React Compiler, react-router v7 | `npm run dev` / `npm run build` / `npm run preview` |
| `strands-agent-typescript/` | Primary agent path: pulls HN stories, walks comments, writes Markdown reports; also hosts the title agent. | `@strands-agents/sdk` on Amazon Bedrock (Claude Haiku 4.5), zod schemas  | `npm run dev` / `npm run build` / `npm start`       |
| `vanilla-agent-python/`     | Reference implementation kept as a comparison baseline for the talk.                                       | Python 3.10+, `httpx`, `openai`, `pydantic` v2, `rich`                   | `hn-sentiment` (after `pip install -e .`)           |

## Report flow

```
strands-agent-typescript/reports/*.md
        │  (prebuild-reports.ts parses YAML front-matter, validates with zod)
        ▼
hacker-news-portal/public/reports/<slug>.md  +  index.json
        │  (staticBackend fetches index.json, then individual bodies; LRU-cached)
        ▼
UI consumes only through src/wireBackend/
```

Reports are flat Markdown files with YAML front-matter (`id`, `title`, `slug`, `generatedAt`, `prompt`). The generated `index.json` is the single source of truth the frontend consumes — no database.

On-demand generation in the portal goes: Generate button → `POST /__api/generate` → Vite middleware invokes `src/generation/GenerationRunner.ts` → sentiment agent produces Markdown → title agent names it → `persistReport.ts` writes the file and bumps the index → the frontend's cache-token subscription refreshes the sidebar without a reload.

## Quick start

1. **Build the primary agent** — the portal's Generate button dynamically imports `strands-agent-typescript/dist/agent.js`, so the agent must be built first:

   ```sh
   cd strands-agent-typescript
   npm install
   npm run build
   ```

2. **Run the portal**:

   ```sh
   cd ../hacker-news-portal
   npm install
   npm run dev
   ```

   The `predev` hook runs `prebuild-reports` first, so the report index is never stale.

3. **Optional — run the Python reference agent** against the same HN front page:

   ```sh
   cd ../vanilla-agent-python
   python3 -m venv .venv && source .venv/bin/activate
   pip install -e .
   hn-sentiment
   ```

   Requires `OPENAI_API_KEY` in `.env`.

Long-running processes (`npm run dev`, `npm run preview`, `hn-sentiment`) should be started from your own terminal.

## Model and credentials

- The primary agent uses **Claude Haiku 4.5 on Amazon Bedrock** via the global cross-Region inference profile ID `global.anthropic.claude-haiku-4-5-20251001-v1:0`. Do not substitute.
- AWS credentials resolve through the **default AWS credential chain** (shared config, SSO, environment, instance role). Secrets are never read from arbitrary `process.env` keys, never hardcoded, and never committed.
- The Python reference agent uses the OpenAI SDK and reads `OPENAI_API_KEY` from a local `.env`.

## Conventions

- **Spec-driven**: `.kiro/specs/` is the source of truth; tasks are generated from requirements and design. See `hackernews-platform-spec.md` for the platform contract.
- **Strict TypeScript everywhere**: `any` is forbidden; narrow with guards rather than widening with `as`.
- **No tests by default**: unit or integration tests are added only when explicitly requested.
- **No new Markdown files** (changelogs, plans, docs) are generated automatically. Existing `README.md` files are updated when the public API or architecture changes.
- **Commits** stay scoped to a single logical purpose, under ~150 lines of source, with `(Kiro)` appended to the author when the agent makes the commit.

## Further reading

- `hackernews-platform-spec.md` — the platform-level spec this repo implements.
- `hacker-news-portal/README.md` — portal scripts, design tokens, React Compiler setup, strict-TS posture.
- `vanilla-agent-python/README.md` — Python agent CLI and configuration.
- `.kiro/steering/` — product, tech, and structure rules enforced across every session.
- `RESOURCES.md` — curated links on prompting, skills, MCP, and spec-driven development.
