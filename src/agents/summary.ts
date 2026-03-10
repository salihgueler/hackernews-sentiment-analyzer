// src/agents/summary.ts

import { Story } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

export async function generateReport(topStories: Story[], bestStories: Story[], date: string): Promise<{ reportPath: string; reportContent: string }> {
  // Create output directory if missing
  const outputDir = 'output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate Markdown header
  let markdown = `# HackerNews Daily Intelligence Report\n`;
  markdown += `**Date**: ${date}\n\n`;
  
  // Top Stories section
  markdown += `## Top Stories\n\n`;
  topStories.forEach((story, index) => {
    const title = story.url ? `[${story.title}](${story.url})` : story.title;
    const sentiment = story.sentiment 
      ? `${story.sentiment.label} (${story.sentiment.confidence}%)`
      : 'No sentiment';
    markdown += `${index + 1}. ${title}\n`;
    markdown += `   - Score: ${story.score}\n`;
    markdown += `   - Sentiment: ${sentiment}\n\n`;
  });
  
  // Best Stories section
  markdown += `## Best Stories\n\n`;
  bestStories.forEach((story, index) => {
    const title = story.url ? `[${story.title}](${story.url})` : story.title;
    const sentiment = story.sentiment 
      ? `${story.sentiment.label} (${story.sentiment.confidence}%)`
      : 'No sentiment';
    markdown += `${index + 1}. ${title}\n`;
    markdown += `   - Score: ${story.score}\n`;
    markdown += `   - Sentiment: ${sentiment}\n\n`;
  });
  
  // Write to file
  const reportPath = path.join(outputDir, 'report.md');
  fs.writeFileSync(reportPath, markdown, 'utf-8');
  
  return {
    reportPath,
    reportContent: markdown
  };
}
