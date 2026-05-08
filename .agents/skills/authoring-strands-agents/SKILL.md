---
name: authoring-strands-agents
description: Authors new Strands Agents (TypeScript SDK) inside this Hacker News sentiment analyzer repo. Use when adding a new agent, wiring tools, defining model config, or validating agent output. Pins Claude Haiku 4.5 on Amazon Bedrock via the global cross-Region inference profile, Zod-validated outputs, strict TypeScript, and the project's no-secrets-in-code rule. Applies to both the Node-only agents under strands-agent-typescript/ and the portal's Node-only generation pipeline under hacker-news-portal/src/generation/.
---

This skill encodes how Strands agents are built in this repository. The project has a standalone sentiment agent (`strands-agent-typescript/src/agent.ts`) with real tools, and a no-tool title agent embedded in the portal's generation pipeline (`hacker-news-portal/src/generation/titleAgent.ts`). New agents should follow the same patterns.

## When to use

Use this skill whenever the task involves creating, modifying, or wiring a Strands `Agent`, `BedrockModel`, or `tool()` in this repo. This includes adding a new agent stage to the generation pipeline, giving an existing agent a new tool, changing an agent's system prompt or decoding contract, or adjusting Zod schemas that validate agent output.

## Mandatory choices

These are non-negotiable. Do not substitute.

- **Model**: Claude Haiku 4.5 on Amazon Bedrock. Use the global cross-Region inference profile ID exactly as spelled below. Do not use Sonnet, Opus, or a regional profile, and do not fall back to the SDK default.

  ```ts
  const CLAUDE_HAIKU_4_5_MODEL_ID =
    "global.anthropic.claude-haiku-4-5-20251001-v1:0";
  ```

- **Model provider**: `BedrockModel` from `@strands-agents/sdk`. Temperature stays low (0.2 is the repo default) and `maxTokens` is set explicitly per agent.
- **Credentials**: resolved by the AWS SDK credential chain. Agent modules MUST NOT read `process.env` for secrets. Region may be injected via an optional `region` option (see `strands-agent-typescript/src/agent.ts` for the pattern); it MUST NOT be hardcoded inline.
- **TypeScript**: strict mode, no `any`, no unused locals or parameters. Treat `unknown` as the correct type for freshly-parsed JSON and narrow through Zod.
- **Testing**: do not author unit or integration tests unless the user explicitly asks for them (workspace steering rule).
- **Markdown files**: do not create new `.md` files. If new docs are needed, update existing `README.md` or the spec.

## Agent skeleton

Every agent module in this repo follows the same shape. Copy this template and adapt only the named pieces.

```ts
import { Agent, BedrockModel } from "@strands-agents/sdk";

const CLAUDE_HAIKU_4_5_MODEL_ID =
  "global.anthropic.claude-haiku-4-5-20251001-v1:0";

const SYSTEM_PROMPT = `...role, inputs, output contract...`;

export function createMyAgent(): Agent {
  const model = new BedrockModel({
    modelId: CLAUDE_HAIKU_4_5_MODEL_ID,
    temperature: 0.2,
    maxTokens: 512, // raise only when the agent produces long reports
  });
  return new Agent({
    model,
    tools: [], // add tools here; empty is fine
    systemPrompt: SYSTEM_PROMPT,
  });
}

let cachedAgent: Agent | null = null;
function getAgent(): Agent {
  if (cachedAgent === null) cachedAgent = createMyAgent();
  return cachedAgent;
}
```

Keep the constructor factory (`createMyAgent`) exported and use a module-scoped memoized `getAgent()` for invocation helpers. This mirrors both `titleAgent.ts` and `agent.ts` and keeps construction cheap across calls.

When the agent is invoked from the browser's build pipeline, mark the module Node-only with a top-of-file comment (see `titleAgent.ts` line 1). The portal's `wireBackend` layer must not import agent modules directly.

## Structured output with Zod

When an agent is expected to return structured data, pin a JSON-only contract in the system prompt and validate on the way out.

1. Define a Zod schema co-located with the agent and export both the schema and its inferred type.
2. After `agent.invoke(...)`, concatenate every `textBlock` in `result.lastMessage.content`. Do not assume a single block.
3. Defensively strip a single outer triple-backtick fence before `JSON.parse` (Haiku occasionally wraps JSON in a fence despite the contract). Any other malformed payload should surface as a thrown `SyntaxError` or `ZodError`.
4. Use `safeParse` first. If the only failure is a `too_big` issue on a capped string field, re-invoke the agent exactly once with a targeted follow-up that quotes the other field back verbatim and restates the constraint (especially any regex, like slug shape). On retry, use `parse` so a second failure surfaces unchanged.

`hacker-news-portal/src/generation/titleAgent.ts` is the canonical implementation of this pattern. Copy its `extractRawText`, `stripJsonCodeFence`, and one-shot retry logic rather than re-deriving them.

Errors bubble up as:

- `SyntaxError` when `JSON.parse` fails (after at-most-one fence strip).
- `ZodError` when the parsed JSON violates the schema (including any retry failure).
- Any SDK or Bedrock error from the underlying `invoke` call.

The `GenerationRunner` maps these to a `titleValidation` stage failure; keep error types unchanged so that mapping still works.

## Tools

Tools live beside the agent that uses them (`strands-agent-typescript/src/tools/*.ts`). Each tool is a single `export const <name>Tool = tool({ ... })` with:

- `name`: snake_case, matches how the model is told to call it.
- `description`: one sentence, tells the model when to call it.
- `inputSchema`: a Zod object with `.describe(...)` on every field. Use bounded `.min`/`.max` and sensible `.default(...)`.
- `callback`: async, returns a typed summary (not raw SDK/HTTP payloads). Define the return type in `src/types.ts` so downstream code can consume it.

`strands-agent-typescript/src/tools/get-front-page-stories.ts` is the reference pattern. New tools should match its shape.

Pass tools via the agent's `tools: [...]` array. Do not mutate the array after construction.

## Anti-patterns

- Selecting any model other than Claude Haiku 4.5, or a non-global Bedrock profile.
- Hardcoding AWS credentials, region defaults buried in the model, or any API key.
- Reading `process.env` inside an agent module for anything other than an explicitly-documented non-secret knob, and never for secrets.
- Introducing `any` to silence a type error; narrow through Zod or refine the schema.
- Creating new `.md` files as part of the task.
- Writing unit tests unless the user asked for them.
- Adding brittle `.refine(...)` rules that the system prompt never teaches the model to satisfy; prefer strengthening the prompt.
- Calling `agent.invoke` from browser code. Agent modules are Node-only.

## Reference files

All canonical examples are one level from here. Read them end to end before authoring a new agent.

- `strands-agent-typescript/src/agent.ts` — agent with tools, configurable region, long-form Markdown output.
- `strands-agent-typescript/src/tools/get-front-page-stories.ts` — tool shape and return-type discipline.
- `hacker-news-portal/src/generation/titleAgent.ts` — no-tool agent, Zod-validated JSON output, fence stripping, one-shot `too_big` retry.
- `hacker-news-portal/src/generation/GenerationRunner.ts` — how agent failures map to pipeline stages; keep thrown error types stable.
