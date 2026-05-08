# Portal Feedback & Facelift Plan

Go through and implement the tasks below for the project under `hacker-news-portal/` folder to implement the following tasks.

## Rules

- NEVER skip the verification step
- Move each completed task from their section to COMPLETED section (with related Phase and Task information).

## Phase A — Issue fixes (must land before the facelift)

These are the concrete defects and best-practice misses found in the audit. They are ordered so every later phase builds on a clean base.

---

## Phase B — Design-system foundation

No visual components change in this phase. The goal is to land tokens, fonts, and helpers so the Phase C component refactors are small diffs.

---

## Phase C — Component facelift

Every component rewrite must continue to satisfy the same a11y and state-machine contracts already documented in the source files (keep the comment blocks — edit them only where behavior changes).

### Task 16. Empty / NotFound / Error facelift

- [ ] 16.1 Redesign `EmptyArchiveView`, `NotFoundView`, and the router `ErrorFallback` with a small inline-SVG illustration (hoisted to module scope per `rendering-hoist-jsx`) and the new type scale.
- [ ] 16.2 Each view gets a single primary action (`Generate` / `Back to latest` / `Retry`) rendered via `Button` primitive.
- [ ] 16.3 Keep `role="alert"` on error copy and `<h2>` landmark.

### Task 17. Motion and micro-interactions

- [ ] 17.1 Add a CSS-only staggered reveal for the masthead → first sidebar section → article header on the initial landing paint, using `animation-delay` on three elements only.
- [ ] 17.2 The reveal is fully neutralized by the existing `prefers-reduced-motion: reduce` block — verify in devtools.
- [ ] 17.3 Progress banner gets a subtle shimmer on its inner rail (still `role="status"`, still readable without motion).
- [ ] 17.4 Focus-visible polish: 2px `--color-focus` outline + 2px offset for all interactive elements.
- [ ] 17.5 No third-party motion library added; pure CSS keyframes.
- Rule source: `frontend-design` (restrained, intentional motion); existing `prefers-reduced-motion` contract in `tokens.css`.

### Task 18. Documentation

- [ ] 18.1 Update `hacker-news-portal/README.md` only (do not create new docs) with: the new font/token story, the React Compiler note, and the new tsconfig flags.
- [ ] 18.2 Update `hacker-news-portal/README.md` sections describing `npm run dev / build / preview` if any script changes.
- [ ] 18.3 No other `.md` files created.
- Rule source: workspace steering rule — update existing `README.md` only when public API or architecture changes.

## Completed Tasks

### Phase C — Task 15. Report view facelift

- [x] 15.1 Rework `src/features/reports/ReportView.tsx` into an article layout: 64-ch column, display-serif `<h1>`, mono `<time>` row below a hairline rule, optional sentiment `<Chip>` row.
- [x] 15.2 Consume the `initialMetadata` prop from Task 4 so the landing route paints instantly.
- [x] 15.3 Replace the inline loading `<p>` with a `<Skeleton>` layout matching the final shape (heading row + meta row + four body lines).
- [x] 15.4 The "Report could not be loaded" banner uses the new error token palette via `.report-view__error`.
- [x] 15.5 Lazy Markdown renderer already in place — no regression.
- Note: `ReportMetadata` does not currently carry a sentiment field. `pickSentimentTone` reads a future `metadata.sentiment` narrowly and returns `undefined` today, so the chip wiring is ready without changing the agent.

### Phase C — Task 14b. Sidebar rewrite

- [x] 14.1 Rebuild `src/app/layout/Sidebar.tsx` to group entries by `Today / This week / Earlier` using the `groupByRecency` helper from Task 14a.
- [x] 14.2 Each entry shows title (body font) + date/slug (mono font, `--font-size-micro`).
- [x] 14.3 Active entry uses the `.sidebar-link.active` rule from Task 2, plus a 2px inline-start accent rule (still centralised in `tokens.css`).
- [x] 14.4 Add hover/focus preload: on `onMouseEnter` / `onFocus`, call `preloadReport(slug)` without awaiting.
- [x] 14.5 Replace the text loading state with three `<Skeleton>` rows.
- [x] 14.6 Keep the error-branch Retry button (now via the Button primitive) and `aria-label="Report archive"` on the nav.
- Rule sources: `bundle-preload`, `rerender-no-inline-components` (dedicated group and item components), `rendering-hoist-jsx` (loading placeholder hoisted).

### Phase C — Task 14a. Sidebar domain helpers — `groupByRecency` and `preloadReport`

- [x] 14.1a Add a pure `groupByRecency(metas, now)` helper to `src/domain/reportMetadata.ts` returning `{ today, thisWeek, earlier }`. Boundaries are UTC-aligned (same-UTC-day for today, trailing 7-day window for thisWeek). `now` is injected so the helper stays deterministic.
- [x] 14.4a Add a fire-and-forget `preloadReport(slug)` helper to `src/wireBackend/staticBackend.ts`, re-exported from the wireBackend barrel. Warms the same LRU body cache used by `getReport` / `getReportBody`, swallows every rejection, and short-circuits when the body is already cached. The `priority: 'low'` request hint is intentionally omitted because the project's TypeScript DOM lib does not yet type it; consumers get the cache warm regardless.
- Rule sources: `bundle-preload` (intent-based preload), `async-parallel` (preload concurrent with navigation).

### Phase C — Task 13b. Masthead layout

- [x] 13.1 Reshape `src/app/layout/Layout.tsx` into a slim masthead: small-caps eyebrow via `SectionLabel`, display-serif site title, Generate button anchored on the trailing edge.
- [x] 13.2 Replace inline `CSSProperties` with a co-located `Layout.css` using the new tokens. No new styling library added.
- [x] 13.5 Verify the banner still lives inside `<main>` above `<Outlet />` (Task 3 semantics preserved).
- Rule sources: `frontend-design`, `rendering-no-inline-styles` (tokens-only styling).

### Phase C — Task 13a. GenerateReportButton uses Button primitive

- [x] 13.3 Swap the current `GenerateReportButton` implementation to use `Button` from `src/ui/Button.tsx` with `variant="primary"` and a `lucide-react` sparkle icon.
- [x] 13.4 Keep the `aria-busy`, `disabled`, and async state-machine untouched.
- Rule sources: `rerender-no-inline-components` (stable component identity), `bundle-barrel-imports` (top-level named lucide import).

### Phase B — Task 12. Scoped Markdown typography

- [x] 12.1 Create `src/markdown/MarkdownRenderer.css` with rules scoped under `.md` for `h2 / h3 / blockquote / code / pre / a / table / ul / ol / img`, plus `p`, `th`, `td`, and list-item spacing.
- [x] 12.2 Apply the className `md` to the renderer root in `MarkdownRenderer.impl.tsx`. Both the success path and the error-fallback `<pre>` sit inside the wrapper so the tokenized typography still applies in the degraded state.
- [x] 12.3 Keep `rehype-highlight` theme wired. The new stylesheet is imported from the lazy impl module, so Vite emits it as a separate `MarkdownRenderer-*.css` chunk loaded alongside the lazy JS. The landing `index-*.css` payload stays at 9.82 KB, unchanged from Task 11c.
- [x] 12.4 Verify the sanitizer schema still allows all the elements the new stylesheet targets. `sanitizeSchema.ts` starts from `hast-util-sanitize`'s `defaultSchema` which already permits h2/h3/blockquote/code/pre/a/table/ul/ol/img and the other targeted tags.
- Rule source: `frontend-design`; no regression to `bundle-dynamic-imports`.

### Phase B — Task 11c. UI primitives — Chip and SectionLabel

- [x] 11.3 Create `src/ui/Chip.tsx` for sentiment/date chips, styled with the mono token. `tone="positive|negative|mixed|neutral"` maps onto the `--color-sentiment-*` tokens.
- [x] 11.4 Create `src/ui/SectionLabel.tsx` for small-caps section headings.
- Rule sources: `rerender-no-inline-components`, `frontend-design`.

### Phase B — Task 11b. UI primitive — Skeleton

- [x] 11.2 Create `src/ui/Skeleton.tsx` exposing a shimmer-aware skeleton primitive. Under `prefers-reduced-motion: reduce` the global animation-duration reset in tokens.css collapses the shimmer to a static rectangle.
- Rule sources: `frontend-design`, `rendering-hoist-jsx` (static variant class list).

### Phase B — Task 11a. UI primitive — Button

- [x] 11.1 Create `src/ui/Button.tsx` exposing `variant: "primary" | "ghost" | "danger"`, `size`, `isLoading`, and `icon` (optional `lucide-react` glyph). Uses the new tokens via co-located `Button.css`.
- [x] 11.5 Import `lucide-react` only via top-level named imports (`LucideProps`). No deep subpaths.
- Rule sources: `rerender-no-inline-components`, `bundle-barrel-imports`, `frontend-design`.

### Phase B — Task 10. Rewrite design tokens

- [x] 10.1 In `src/styles/tokens.css`, replace the color palette with the new set and add sentiment chip tokens. Legacy names (`--color-text`, `--color-text-muted`, `--color-border`) are kept as aliases pointing at the new names so Phase B lands without visual regressions; Phase C retires them.
- [x] 10.2 Add a proper type scale in rem, with new tokens for display vs body, font families, and line-heights (`--line-tight`, `--line-body`, `--line-loose`).
- [x] 10.3 Add radius, elevation, and rule tokens: `--radius-sm`, `--radius-md`, `--radius-lg`, `--rule-hairline: 1px`, `--shadow-soft`.
- [x] 10.4 Verify every new color pair meets WCAG AA for text (4.5:1) or non-text (3:1) as appropriate. Computed ratios documented in a comment block above the palette.
- [x] 10.5 Keep the `prefers-reduced-motion` block untouched.
- Rule source: `frontend-design` skill (bold, intentional, cohesive palette); accessibility § of the existing `tokens.css`.

### Phase B — Task 9. Self-host the new font stack

- [x] 9.1 Add `@fontsource-variable/fraunces`, `@fontsource-variable/inter-tight`, `@fontsource-variable/jetbrains-mono` to dependencies.
- [x] 9.2 Import the required weight ranges in `src/main.tsx` (after the `tokens.css` import) so the fonts load on the critical path but still benefit from Vite's asset hashing.
- [x] 9.3 Confirm no runtime Google Fonts or CDN fetch — everything self-hosted.
- [x] 9.4 Verify fonts are tree-shaken per weight; import only the axes we use. Each package ships a `wght.css` upright-only entry file; only that axis file is imported, so no italic or extra-axis woff2 ships to the browser.
- Rule source: `frontend-design` typography guidance (avoid Inter/Roboto defaults, commit to characterful pairing); `bundle-barrel-imports` (avoid pulling full foundry barrels).

### Phase A — Task 8. Enable the React Compiler

- [x] 8.1 Add `babel-plugin-react-compiler` as a dev dependency in `hacker-news-portal/package.json`.
- [x] 8.2 Wire it into `vite.config.ts`. `@vitejs/plugin-react` v6 no longer exposes a top-level `babel` option; the supported path is the exported `reactCompilerPreset({ target: "19" })` helper fed through `@rolldown/plugin-babel` alongside `react()`.
- [x] 8.3 Build and verify the bundle size does not regress; confirm no new runtime warnings in the dev server console.
- [x] 8.4 Spot-check that existing `useCallback` / `useMemo` calls are still correct (compiler augments, does not replace).
- Rule source: unlocks `rerender-*` category of rules automatically for every new component authored in Phase B/C.

### Phase A — Task 7. Tighten TypeScript, aligned with `strands-agent-typescript`

- [x] 7.1 Edit `hacker-news-portal/tsconfig.app.json`. Add `"noImplicitOverride": true`, `"forceConsistentCasingInFileNames": true`, `"noImplicitReturns": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
- [x] 7.2 Run `tsc -b` and fix every new error. Expected hot spots:
  - `src/app/routes.tsx` — index accesses against `sortReportsForDisplay` results.
  - `src/domain/reportMetadata.ts` — any `siblings[i]` index access.
  - `src/wireBackend/types.ts` — confirm `BackendError.stage` assignment still satisfies `exactOptionalPropertyTypes`.
  - `src/features/generate/GenerationStatus.tsx` — same for `setError` payloads.
- [x] 7.3 Resolve errors by narrowing (`if (value === undefined) …`) rather than widening types. No new `as` casts and no `any`.
- [x] 7.4 Update `tsconfig.node.json` with the same flags so `scripts/` and `plugins/` share the posture.
- [x] 7.5 Confirm `verbatimModuleSyntax` + the new flags compose cleanly.
- Rule sources: TS strictness cross-referenced with `strands-agent-typescript/tsconfig.json`; the `vercel-react-best-practices` skill's compatibility note that deep third-party imports can defeat `strict`/`noImplicitAny`.

### Phase A — Task 6. Prepare for scroll/resize-driven effects

- [x] 6.1 Create `src/app/hooks/useScrollY.ts` exposing a `useScrollY()` hook that reads `window.scrollY` through `useSyncExternalStore` with a `{ passive: true }` listener.
- [x] 6.2 Export a companion `useMediaQuery(query: string)` hook using the same `useSyncExternalStore` pattern.
- [x] 6.3 Wrap scroll-derived state updates in `startTransition` so scroll does not block paint.
- [x] 6.4 Do not consume the hooks yet; Phase C wires them into the new masthead and reveal animations.
- Rule sources: `client-event-listeners` (dedupe), `client-passive-event-listeners` (passive), `rerender-transitions` (transition-wrapped updates).

### Phase A — Task 5. Hoist placeholder JSX to module scope

- [x] 5.1 In `src/app/routes.tsx`, hoist the `<section>…Loading archive…</section>` fragment into a module-scoped constant.
- [x] 5.2 In `src/features/reports/ReportView.tsx`, hoist the `Loading report…` placeholder into a module-scoped constant.
- [x] 5.3 In `src/markdown/MarkdownRenderer.tsx`, hoist the `<p>Loading report…</p>` Suspense fallback.
- [x] 5.4 Keep alert banners dynamic — only the static fragments move.
- Rule source: `rendering-hoist-jsx`. (Phase C replaces these with real skeletons, but hoisting first keeps the diff readable.)

### Phase A — Task 4. Eliminate the duplicate `listReports()` render on landing

- [x] 4.1 In `src/app/routes.tsx`, extend `LandingRoute` to pass the selected `ReportMetadata` as an `initialMetadata` prop to `ReportView`.
- [x] 4.2 In `src/features/reports/ReportView.tsx`, add an optional `initialMetadata` prop to `ReportViewProps`.
- [x] 4.3 When `initialMetadata` is provided and matches the current `slug`, seed state with `{ kind: "ready", payload: { metadata, body: "" }, siblings: [...] }`-style fast path that only fetches the body (skip the second `listReports()` round trip).
- [x] 4.4 Keep the existing `Promise.all([getReport, listReports])` path for the direct-URL case (`/reports/:slug`).
- [x] 4.5 Confirm the static-backend module cache still deduplicates; this change removes a render cycle, not a network call.
- Rule source: `async-dependencies` / `async-parallel` (avoid redundant awaits when a parent has already resolved them).

### Phase A — Task 1. Fix broken / stale CSS tokens

- [x] 1.1 Audit `src/styles/tokens.css` and confirm `--font-size-heading` is not defined.
- [x] 1.2 Add `--font-size-heading: var(--font-size-heading-2);` to the `:root` block so existing usages resolve to a real value (temporary; Phase B replaces the scale wholesale).
- [x] 1.3 Grep for every `var(--font-size-heading)` callsite (currently `ReportView.tsx`, `EmptyArchiveView.tsx`, `NotFoundView.tsx`) and verify they now render at the intended size.
- [x] 1.4 Verify no other `var(--...)` in the repo references an undefined token.
- Rule source: correctness / silent fallbacks; not a skill rule, but a real bug.

### Phase A — Task 2. Give the active NavLink a visible style

- [x] 2.1 Add a `.sidebar-link.active` CSS rule (left accent bar + bolder weight) to `tokens.css` or a new `Sidebar.module.css`.
- [x] 2.2 Replace the inline style on `NavLink` in `src/app/layout/Sidebar.tsx` with a stable `className="sidebar-link"` plus the `isActive` suffix.
- [x] 2.3 Confirm `aria-current="page"` is still emitted by React Router's built-in behavior.
- [x] 2.4 Verify focus ring (`:focus-visible`) still lands on the link and is visually distinct from the active state.
- Rule source: WCAG 1.4.1 (color/identifier alone). Matches the `frontend-design` skill's guidance that active states must be visually intentional.

### Phase A — Task 3. Move the generation banner above `<Outlet />`

- [x] 3.1 In `src/features/generate/GenerationStatus.tsx`, split `GenerationStatusProvider` so the banner region is exposed as a separate `<GenerationStatusBanner />` component instead of being rendered as the last child.
- [x] 3.2 In `src/app/layout/Layout.tsx`, render `<GenerationStatusBanner />` inside `<main>` above `<Outlet />`, not at the end of the provider tree.
- [x] 3.3 Confirm `role="status"` / `role="alert"` semantics are preserved on the banner element.
- [x] 3.4 Verify the banner still clears on successful navigation after a run.
- Rule source: UX correctness; also supports `rendering-conditional-render` (banner absence returns `null`, not an empty wrapper).

---

## Dependency graph

```
1,2,3,4,5 ──┐
6 ──────────┤
7 ──────────┼──► 8 ──► 9 ──► 10 ──► 11 ──► 12 ──► 13,14,15,16 ──► 17 ──► 18
```

Phase A tasks (1–8) are independent of each other and can land in parallel PRs, but each is a separate commit. Phase B tasks (9–12) land after the compiler is on. Phase C tasks (13–16) run in parallel once the UI primitives are ready. Task 17 folds in last because it depends on the final markup. Task 18 is the docs sweep.

## Out of scope

- Agent code, model selection, Bedrock region, and Zod schemas: untouched.
- New routes, new features beyond the sentiment-chip row on the report header.
- Any backend changes (no new `/__api/*` endpoints).
- Tests — explicitly not authored unless requested.
- Production deploy config — the Vite dev/prod pipeline is unchanged.
