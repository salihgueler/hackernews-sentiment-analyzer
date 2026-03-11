# Amazon Bedrock Configuration

## Basic Setup

```typescript
import { Agent, BedrockModel } from "@strands-agents/sdk";

const agent = new Agent({
  model: new BedrockModel({
    modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
    region: "us-east-1",
    temperature: 0.7,
    maxTokens: 2048,
  }),
});
```

## AWS Credentials

Set via environment variables:

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

## Region Resolution Order

1. Explicit `region` in BedrockModel
2. AWS SDK credential chain
3. Default: `us-west-2`
