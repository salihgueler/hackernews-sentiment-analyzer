# Multi-Agent: Agents as Tools

Wrap specialized agents as callable tools for an orchestrator.

```typescript
import { Agent, tool } from "@strands-agents/sdk";
import { z } from "zod";

// Specialist wrapped as tool
const sentimentTool = tool({
  name: "analyze_sentiment",
  description: "Analyzes sentiment of text",
  inputSchema: z.object({ text: z.string() }),
  callback: async (input) => {
    const agent = new Agent({
      systemPrompt: "Return only: positive, negative, or neutral.",
    });
    return await agent.invoke(input.text);
  },
});

// Parallel execution
const [sentiment, summary] = await Promise.all([
  sentimentAgent.invoke(text),
  summaryAgent.invoke(text),
]);
```

## Error Handling for Parallel Agents

```typescript
// Tolerates partial failures
const results = await Promise.allSettled(
  items.map((item) => agent.invoke(item)),
);

const successful = results
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);
```
