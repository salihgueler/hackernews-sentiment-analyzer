# Troubleshooting

## "On-demand throughput isn't supported"

Use regional prefix:

```typescript
model: "us.anthropic.claude-sonnet-4-20250514-v1:0";
```

## "Model identifier is invalid"

Region doesn't support inference profiles — use base model ID:

```typescript
model: "anthropic.claude-3-5-sonnet-20241022-v2:0";
```

## Context Window Overflow

Use SlidingWindowConversationManager to limit message history.

## Never

- Store API keys in code — use environment variables
- Use Python-only patterns: Swarm, Workflow, Graph
