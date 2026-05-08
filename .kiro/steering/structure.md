# Structure

## Top-level layout

```
hackernews-sentiment-analyzer/
├── .agents/skills/            # Portable skills (authoring-strands-agents, frontend-design, vercel-react-best-practices)
├── .kiro/
│   ├── specs/                 # Spec-driven feature folders (requirements.md, design.md, tasks.md)
│   └── steering/              # This folder: product.md, tech.md, structure.md
├── hacker-news-portal/        # React + Vite frontend (visitor-facing surface)
├── strands-agent-typescript/  # Primary Strands Agents SDK implementation (TypeScript)
├── vanilla-agent-python/      # Reference Python implementation (OpenAI SDK)
├── hackernews-platform-spec.md
├── feedback-and-facelift-plan.md
└── themes-agent-plan.md
```

Three sibling packages, each with its own `package.json` / `pyproject.toml` and its own install/build lifecycle. Do not introduce a root-level workspace manifest; keep the packages independent.

## `hacker-news-portal/`

```
hacker-news-portal/
├── index.html
├── vite.config.ts             # React plugin + React Compiler preset + generation middleware
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── plugins/
│   └── generation-plugin.ts   # Vite middleware exposing /__api/generate in dev + preview
├── scripts/
│   └── prebuild-reports.ts    # Parses ../strands-agent-typescript/reports/*.md → public/reports/
├── public/                    # Static assets; public/reports/ is derived output (gitignored)
└── src/
    ├── main.tsx               # Entry: imports tokens.css, fontsource axis files, then mounts <App />
    ├── App.tsx                # Router host
    ├── app/
    │   ├── routes.tsx         # Route table (LandingRoute, ReportRoute, NotFoundRoute, ErrorFallback)
    │   ├── hooks/             # useScrollY, useMediaQuery (useSyncExternalStore-backed)
    │   └── layout/            # Layout (masthead), Sidebar
    ├── domain/                # Pure helpers: frontMatter, reportMetadata, slug
    ├── features/
    │   ├── generate/          # GenerationStatus provider + GenerationStatusBanner + GenerateReportButton
    │   └── reports/           # ReportView + supporting pieces
    ├── generation/            # Excluded from src/ tsconfig — runs in the Vite plugin context
    │   ├── GenerationRunner.ts
    │   ├── persistReport.ts
    │   └── titleAgent.ts
    ├── markdown/              # Lazy MarkdownRenderer.impl + sanitize schema + highlight theme
    ├── styles/                # tokens.css (design system), motion.css (reveal / shimmer)
    ├── ui/                    # Reusable primitives: Button, Skeleton, Chip, SectionLabel (each with co-located .css)
    └── wireBackend/           # Interface the UI consumes; staticBackend reads public/reports, generationClient talks to /__api/generate
```

Conventions:

- **Styling** uses co-located CSS files next to the component (`Button.tsx` + `Button.css`). No CSS-in-JS, no inline `style` objects for layout (only for truly dynamic values).
- **Primitives live in `src/ui/`**; feature-specific components stay in `src/features/<name>/` and compose primitives.
- **Lazy-loaded Markdown**: import `MarkdownRenderer.tsx` (the lazy wrapper), never the `.impl.tsx` directly, so the Markdown chunk stays off the critical path.
- **`src/wireBackend/`** is the only module that talks to the report storage / generation API. Feature components should not fetch directly.
- **`src/generation/`** is excluded from the app tsconfig and is imported dynamically by the Vite plugin; it runs in Node, not the browser.
- **`lucide-react` icons** are imported via top-level named specifiers only (`import { Sparkles } from "lucide-react"`). No deep subpath imports.

## `strands-agent-typescript/`

```
strands-agent-typescript/
├── package.json
├── tsconfig.json
├── .env.example
├── reports/                   # Markdown reports with YAML front-matter (id, title, slug, generatedAt, prompt)
└── src/
    ├── index.ts               # CLI entry
    ├── agent.ts               # Agent factory + memoized getAgent() + invoke helpers + zod schemas
    ├── hn-client.ts           # Hacker News Firebase API client
    ├── types.ts               # Shared domain types
    └── tools/                 # Strands tools
```

Conventions:

- One agent per module. Each exports a `create<Name>Agent()` factory and a module-scoped memoized `getAgent()`.
- Zod schemas live next to the agent that produces them; both the schema and inferred type are exported.
- System prompts are JSON-only. The invoker extracts text from every `textBlock` in `result.lastMessage.content`, strips a single optional code fence, then `safeParse`s.
- Model ID lives as a named constant at the top of the file (never inline).

## `vanilla-agent-python/`

```
vanilla-agent-python/
├── pyproject.toml
├── requirements.txt
├── .env.example
└── src/hn_sentiment/
    ├── __init__.py            # Public exports
    ├── models.py              # Pydantic models
    ├── hn_client.py           # Async HN API client
    ├── sentiment.py           # LLM-backed classifier + summarizers
    ├── agent.py               # Orchestration (SentimentAgent, AgentConfig)
    ├── report.py              # Rich console + markdown renderers
    └── cli.py                 # argparse CLI entry
```

## `.kiro/specs/`

Specs follow the `.kiro/specs/{feature-name}/` layout with kebab-case folders and the standard file set (`requirements.md`, `design.md`, `tasks.md`, and for bugfixes `bugfix.md`). Specs are the source of truth; tasks are generated from them.

## Report flow

```
strands-agent-typescript/reports/*.md
        │  (prebuild-reports.ts parses YAML front-matter, validates with zod)
        ▼
hacker-news-portal/public/reports/<slug>.md  +  index.json
        │  (staticBackend fetches index.json, then individual bodies; LRU-cached)
        ▼
UI components (Sidebar, ReportView) consume only through src/wireBackend/
```

New generations initiated from the UI call `POST /__api/generate` → the Vite plugin invokes `src/generation/GenerationRunner.ts` → the sentiment agent produces Markdown → the title agent names it → `persistReport.ts` writes the file + bumps the index → the frontend's cache-token subscription refreshes the sidebar without a page reload.
