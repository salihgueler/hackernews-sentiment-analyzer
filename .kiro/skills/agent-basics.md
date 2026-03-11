# Agent Basics

## Creating an Agent

```typescript
import { Agent } from "@strands-agents/sdk";

const agent = new Agent({
  systemPrompt: "You are a specialist agent.",
  tools: [myTool],
});

// Single invocation
const result = await agent.invoke("Query here");

// Streaming
for await (const event of agent.stream("Query here")) {
  if (event.type === "contentBlockDelta") {
    process.stdout.write(event.delta.text);
  }
}
```

## Conversation Management

```typescript
// Sliding window (default) — keeps recent messages
import { SlidingWindowConversationManager } from "@strands-agents/sdk";

const agent = new Agent({
  conversationManager: new SlidingWindowConversationManager({ windowSize: 10 }),
});

// No memory
import { NullConversationManager } from "@strands-agents/sdk";
const agent = new Agent({
  conversationManager: new NullConversationManager(),
});
```
