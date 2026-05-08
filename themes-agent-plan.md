# Cross-Report Themes Agent — Plan

> Demo agent intended to showcase the `authoring-strands-agents` skill.
> This document is a plan only; no code has been written yet.

## Goal

Add a quick, self-contained second agent to the repo that exercises every
rule in the `authoring-strands-agents` skill in one small, isolated
surface area. The agent reads every existing sentiment report, finds
recurring patterns across them, and prints a Zod-validated JSON summary
to stdout.

## Why this agent

- Truly quick: two new files plus a one-line `package.json` addition,
  roughly 120 lines total.
- Hits every mandatory choice in the skill in one pass: pinned Claude
  Haiku 4.5 global inference profile ID, `BedrockModel`, memoized
  `getAgent()`, JSON-only system prompt, Zod schema, extract-text +
  fence-strip helpers.
- Uses a different decoding contract from `titleAgent.ts` (an array of
  objects rather than a flat `{ title, slug }`), so it is not a
  copy-paste twin.
- Safe. Does not touch any hot path and cannot break generation.
- Runs from a single `npm run themes` in under a minute.

## Scope

- New: `strands-agent-typescript/src/themes-agent.ts` — the agent
  module (factory, memoized instance, Zod schema, `invokeThemesAgent`).
- New: `strands-agent-typescript/src/themes.ts` — CLI entry that reads
  `strands-agent-typescript/reports/*.md`, joins the bodies with a
  separator, calls the agent, prints the validated JSON.
- Edit: `strands-agent-typescript/package.json` — add a `themes`
  script: `tsx src/themes.ts`.

## Out of scope

- UI changes in the portal.
- Persistence of themes into report front-matter or `index.json`.
- Wiring the agent into the `GenerationRunner` pipeline.
- Unit or integration tests (workspace steering rule: tests only on
  explicit request).
- Any new Markdown files beyond this plan.

## Agent shape (draft, not final)

```ts
import { Agent, BedrockModel } from "@strands-agents/sdk";
import { z } from "zod";

const CLAUDE_HAIKU_4_5_MODEL_ID =
  "global.anthropic.claude-haiku-4-5-20251001-v1:0";

const SYSTEM_PROMPT = `...extract 3 to 8 recurring themes...JSON-only...`;

export const ThemesSchema = z.object({
  themes: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        description: z.string().min(1).max(280),
        reportCount: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(8),
});

export function createThemesAgent(): Agent {
  const model = new BedrockModel({
    modelId: CLAUDE_HAIKU_4_5_MODEL_ID,
    temperature: 0.2,
    maxTokens: 1024,
  });
  return new Agent({ model, tools: [], systemPrompt: SYSTEM_PROMPT });
}

// plus: memoized getAgent(), extractRawText(), stripJsonCodeFence(),
// and invokeThemesAgent(corpus) that safeParses then parses on retry.
```

## CLI shape (draft)

- Read `strands-agent-typescript/reports/`, list `.md` files.
- Concatenate their bodies with a clear `--- report N ---` separator.
- Call `invokeThemesAgent(corpus)`.
- `console.log(JSON.stringify(result, null, 2))`.
- Non-zero exit on thrown `ZodError` or `SyntaxError`, logging the cause.

## Skill coverage checklist

The agent must demonstrate every mandatory rule in
`.agents/skills/authoring-strands-agents/SKILL.md`:

- [ ] Claude Haiku 4.5 global cross-Region inference profile ID.
- [ ] `BedrockModel` with explicit `temperature` and `maxTokens`.
- [ ] No `process.env` reads for secrets; credential chain only.
- [ ] Strict TypeScript, no `any`.
- [ ] Exported factory `createThemesAgent()` + module-scoped memoized
      `getAgent()`.
- [ ] JSON-only system prompt, no fenced output expected.
- [ ] Zod schema co-located with the agent; both schema and inferred
      type exported.
- [ ] Text extraction that concatenates every `textBlock` in
      `result.lastMessage.content`.
- [ ] Defensive single-fence strip before `JSON.parse`.
- [ ] `safeParse` first, then `parse` on a single targeted retry.
- [ ] No new `.md` files (this plan is the explicit exception).
- [ ] No unit tests unless the user asks.

## Alternatives considered

- **TL;DR agent (UI-visible)**: one-line summary persisted into each
  report's front-matter and surfaced in the sidebar. More compelling
  visually but touches `persistReport.ts`, `prebuild-reports.ts`,
  `frontMatter.ts`, `reportMetadata.ts`, `Sidebar.tsx`, and
  `GenerationRunner.ts`. Six to seven files. Does not meet the
  "quick" bar.
- **Prompt-sanitizer agent**: cleans up a user-submitted prompt before
  the sentiment agent runs. Almost free to write, but the portal does
  not currently accept a user prompt, so there is nowhere to plug it
  in.

## Next step

Await approval, then implement as scoped above.
