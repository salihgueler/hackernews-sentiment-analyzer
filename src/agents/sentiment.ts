// src/agents/sentiment.ts

import { Comment, SentimentResult } from '../types/index.js';

export async function analyzeSentiment(storyId: number, comments: Comment[]): Promise<SentimentResult> {
  // Handle zero-comment case
  if (comments.length === 0) {
    return {
      label: "No sentiment",
      confidence: 0
    };
  }
  
  try {
    // Aggregate comment text
    const aggregatedText = comments.map(c => c.text).join(' ');
    
    // Mock LLM analysis (in production, would use Strands SDK LLM access)
    // Simple heuristic for demo: count positive/negative keywords
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'poor', 'disappointing'];
    
    const lowerText = aggregatedText.toLowerCase();
    const positiveCount = positiveWords.reduce((count, word) => count + (lowerText.match(new RegExp(word, 'g')) || []).length, 0);
    const negativeCount = negativeWords.reduce((count, word) => count + (lowerText.match(new RegExp(word, 'g')) || []).length, 0);
    
    if (positiveCount > negativeCount) {
      return {
        label: "positive",
        confidence: Math.min(50 + positiveCount * 5, 95)
      };
    } else if (negativeCount > positiveCount) {
      return {
        label: "negative",
        confidence: Math.min(50 + negativeCount * 5, 95)
      };
    } else {
      return {
        label: "neutral",
        confidence: 60
      };
    }
  } catch (error) {
    console.error(`ERROR [analyzeSentiment ${storyId}]:`, error);
    return {
      label: "neutral",
      confidence: 30
    };
  }
}
