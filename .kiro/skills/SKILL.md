---
name: strands-agents-typescript
description: Builds AI agents using Strands Agents TypeScript SDK with Amazon Bedrock. Use when creating agents, tools, multi-agent patterns, or MCP integrations in TypeScript.
---

# Strands Agents TypeScript SDK

Experimental TypeScript SDK for building AI agents. Core functionality works — breaking changes possible.

## Quick Start

```typescript
import { Agent } from "@strands-agents/sdk";

const agent = new Agent({
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.invoke("Your query here");
```

## Default Setup

- Default model: Amazon Bedrock Claude Sonnet 4.5
- Requires: Node.js 20+, AWS credentials configured
- Install: `npm install @strands-agents/sdk zod`

## Core Patterns

- **Single agent**: See [agent-basics.md](agent-basics.md)
- **Custom tools**: See [tools.md](tools.md)
- **Multi-agent (Agents as Tools)**: See [multiagent.md](multiagent.md)
- **Bedrock configuration**: See [bedrock.md](bedrock.md)
- **Troubleshooting**: See [troubleshooting.md](troubleshooting.md)

## TypeScript-Only Limitations

- No structured output (Python only)
- No guardrails (Python only)
- No Swarm, Workflow, Graph patterns (Python only)
- Use async iterators for streaming (no callback handlers)
