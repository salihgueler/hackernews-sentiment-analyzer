# Custom Tools

## Basic Tool

```typescript
import { tool } from "@strands-agents/sdk";
import { z } from "zod";

const myTool = tool({
  name: "tool_name",
  description: "Clear description of what this tool does",
  inputSchema: z.object({
    param: z.string().describe("Parameter description"),
  }),
  callback: async (input) => {
    return `Result: ${input.param}`;
  },
});

const agent = new Agent({ tools: [myTool] });
```

## MCP Integration

```typescript
import { McpClient } from "@strands-agents/sdk";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const mcpTools = new McpClient({
  transport: new StdioClientTransport({
    command: "uvx",
    args: ["your-mcp-server"],
  }),
});

const agent = new Agent({ tools: [mcpTools] });
await mcpTools.disconnect();
```
