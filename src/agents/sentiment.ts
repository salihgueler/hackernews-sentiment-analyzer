// src/agents/sentiment.ts

import { Agent, BedrockModel } from '@strands-agents/sdk';
import { Comment, SentimentResult } from '../types/index.js';

export async function analyzeSentiment(storyId: number, comments: Comment[]): Promise<SentimentResult> {
  if (comments.length === 0) {
    return { label: "No sentiment", confidence: 0 };
  }
  
  try {
    const aggregatedText = comments.map(c => c.text).join(' ');
    
    const agent = new Agent({
      model: new BedrockModel({
        modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        region: process.env.AWS_REGION || 'us-east-1',
        temperature: 0.3,
        maxTokens: 200,
      }),
      systemPrompt: 'Analyze sentiment of text. Respond ONLY with valid JSON: {"label": "positive"|"negative"|"neutral", "confidence": number}. Confidence is 0-100.',
    });
    
    const response = await agent.invoke(`Analyze sentiment:\n\n${aggregatedText.slice(0, 3000)}`);
    const parsed = JSON.parse(response.toString());
    
    return {
      label: parsed.label,
      confidence: parsed.confidence
    };
  } catch (error) {
    console.error(`ERROR [analyzeSentiment ${storyId}]:`, error);
    return { label: "neutral", confidence: 30 };
  }
}
