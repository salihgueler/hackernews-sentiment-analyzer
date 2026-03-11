// src/agents/summary.ts

import { Agent, BedrockModel } from "@strands-agents/sdk";
import { Story } from "../types/index.js";
import * as fs from "fs";
import * as path from "path";

async function generateSentimentSummary(
  topStories: Story[],
  bestStories: Story[],
): Promise<string> {
  const allStories = [...topStories, ...bestStories];
  const storyData = allStories.map((s) => ({
    title: s.title,
    score: s.score,
    sentiment: s.sentiment?.label ?? "unknown",
    confidence: s.sentiment?.confidence ?? 0,
  }));

  const agent = new Agent({
    model: new BedrockModel({
      modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      region: process.env.AWS_REGION || "us-east-1",
      temperature: 0.5,
      maxTokens: 400,
    }),
    systemPrompt:
      "You are a concise analyst. Given HackerNews story data with sentiment labels and confidence scores, write an overall sentiment analysis in exactly 5 sentences or fewer. Focus on the dominant mood, notable trends, and any outliers. Do not use bullet points or headers — just a plain paragraph.",
  });

  try {
    const response = await agent.invoke(
      `Analyze the overall sentiment from these HackerNews stories:\n\n${JSON.stringify(storyData, null, 2)}`,
    );
    return response.toString().trim();
  } catch (error) {
    console.error("ERROR [generateSentimentSummary]:", error);
    return "Unable to generate overall sentiment analysis.";
  }
}

export async function generateReport(
  topStories: Story[],
  bestStories: Story[],
  date: string,
): Promise<{ reportPath: string; reportContent: string }> {
  // Create output directory if missing
  const outputDir = "output";
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
      : "No sentiment";
    const summaryText = story.sentiment?.summary || "";
    markdown += `${index + 1}. ${title}\n`;
    markdown += `   - Score: ${story.score}\n`;
    markdown += `   - Sentiment: ${sentiment}\n`;
    if (summaryText) {
      markdown += `   - ${summaryText}\n`;
    }
    markdown += `\n`;
  });

  // Best Stories section
  markdown += `## Best Stories\n\n`;
  bestStories.forEach((story, index) => {
    const title = story.url ? `[${story.title}](${story.url})` : story.title;
    const sentiment = story.sentiment
      ? `${story.sentiment.label} (${story.sentiment.confidence}%)`
      : "No sentiment";
    const summaryText = story.sentiment?.summary || "";
    markdown += `${index + 1}. ${title}\n`;
    markdown += `   - Score: ${story.score}\n`;
    markdown += `   - Sentiment: ${sentiment}\n`;
    if (summaryText) {
      markdown += `   - ${summaryText}\n`;
    }
    markdown += `\n`;
  });

  // Generate overall sentiment analysis via Strands agent
  const sentimentSummary = await generateSentimentSummary(
    topStories,
    bestStories,
  );
  markdown += `## Overall Sentiment Analysis\n\n${sentimentSummary}\n`;

  // Write to file
  const reportPath = path.join(outputDir, "report.md");
  fs.writeFileSync(reportPath, markdown, "utf-8");

  return {
    reportPath,
    reportContent: markdown,
  };
}
