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

## Design system

The Portal ships with a token-driven design system under `src/styles/tokens.css`:

- **Fonts (self-hosted)** — Fraunces (display), Inter Tight (body), and JetBrains Mono (code) via `@fontsource-variable/*`. Each package ships an upright-only `wght.css` axis entry; only that file is imported, so no italic or extra-axis woff2 ever ships. Imports live in `src/main.tsx` immediately after the tokens stylesheet.
- **Color palette** — warm editorial background (`--color-bg: #faf7f2`) plus a single accent (`--color-accent: #e14a00`). Every foreground/background pair carries its measured WCAG contrast ratio as a comment; all body text pairs clear AA (4.5:1), and the focus outline clears 3:1 against both bg surfaces.
- **Type scale** — `--font-size-display-1/-2`, `--font-size-heading-1/-2/-3`, `--font-size-body`, `--font-size-small`, `--font-size-micro`, paired with `--line-tight / --line-body / --line-loose`.
- **Chrome tokens** — `--radius-sm/-md/-lg`, `--rule-hairline`, `--shadow-soft`.
- **Sentiment tokens** — `--color-sentiment-positive/-negative/-mixed/-neutral` for chip surfaces.
- **Reduced motion** — the global `@media (prefers-reduced-motion: reduce)` block clamps every animation and transition duration; reveal animations and the progress-banner shimmer collapse automatically.

Reusable UI primitives live under `src/ui/`:

- `Button.tsx` — `variant: "primary" | "ghost" | "danger"` plus `size` and `isLoading`. Optional `icon` prop accepts any `lucide-react` glyph (imported via the top-level named specifier only).
- `Skeleton.tsx` — `variant: "line" | "block"` shimmer placeholder, neutralized under reduced motion.
- `Chip.tsx` — `tone: "positive" | "negative" | "mixed" | "neutral"` tag styled in the mono font.
- `SectionLabel.tsx` — small-caps eyebrow label.

Scoped Markdown typography (`src/markdown/MarkdownRenderer.css`) is loaded only inside the lazy `MarkdownRenderer.impl` chunk, so the landing critical path stays lean.

## React Compiler

The build enables the React Compiler via `@vitejs/plugin-react` v6's `reactCompilerPreset` helper. Plugin-react v6 no longer exposes a top-level `babel` option, so the supported path is:

```ts
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ target: "19" })] }),
    // ...
  ],
});
```

Peer dependencies are pinned to exact versions:

- `babel-plugin-react-compiler@1.0.0`
- `@rolldown/plugin-babel@0.2.3`

The compiler augments existing `useMemo` / `useCallback` calls rather than replacing them, so every manual memoization in the codebase stays correct.

## Strict TypeScript

Both `tsconfig.app.json` and `tsconfig.node.json` enable the full strict posture:

- `strict`
- `noImplicitAny`
- `noUnusedLocals`
- `noUnusedParameters`
- `noFallthroughCasesInSwitch`
- `noImplicitOverride`
- `forceConsistentCasingInFileNames`
- `noImplicitReturns`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `verbatimModuleSyntax`
- `erasableSyntaxOnly`

Under `noUncheckedIndexedAccess`, indexed reads return `T | undefined` and must be narrowed explicitly. Under `exactOptionalPropertyTypes`, optional props must be declared as `T | undefined` if the caller may pass `undefined` explicitly. Follow the patterns already established in `src/ui/` and `src/features/reports/` when adding new components.
