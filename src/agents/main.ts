// src/agents/main.ts

import { Story } from '../types/index.js';
import * as hnApi from '../tools/hackernews.js';
import { analyzeSentiment } from './sentiment.js';
import { generateReport } from './summary.js';

export async function runMainAgent(): Promise<void> {
  const startTime = Date.now();
  console.log('Starting HackerNews Daily Intelligence Agent...');
  
  // Fetch story IDs
  const [topStoryIds, bestStoryIds] = await Promise.all([
    hnApi.fetchTopStories(),
    hnApi.fetchBestStories()
  ]);
  
  console.log(`Fetched ${topStoryIds.length} top story IDs and ${bestStoryIds.length} best story IDs`);
  
  // Fetch story details in parallel (max 20 concurrent)
  const topStoryPromises = topStoryIds.map(id => hnApi.fetchStory(id));
  const bestStoryPromises = bestStoryIds.map(id => hnApi.fetchStory(id));
  
  const [topStoriesRaw, bestStoriesRaw] = await Promise.all([
    Promise.all(topStoryPromises),
    Promise.all(bestStoryPromises)
  ]);
  
  // Filter out null results (failed fetches)
  const topStories = topStoriesRaw.filter((s): s is Story => s !== null);
  const bestStories = bestStoriesRaw.filter((s): s is Story => s !== null);
  
  console.log(`Successfully fetched ${topStories.length + bestStories.length} stories`);
  console.log('Fetching comments and analyzing sentiment...\n');
  
  // Fetch comments and analyze sentiment in parallel for both lists
  const analyzeSentimentForStories = async (stories: Story[]) => {
    const promises = stories.map(async (story) => {
      const commentIds = story.kids || [];
      const comments = await hnApi.fetchComments(story.id, commentIds);
      const sentiment = await analyzeSentiment(story.id, comments);
      story.sentiment = sentiment;
      return story;
    });
    return Promise.all(promises);
  };
  
  const [topStoriesWithSentiment, bestStoriesWithSentiment] = await Promise.all([
    analyzeSentimentForStories(topStories),
    analyzeSentimentForStories(bestStories)
  ]);
  
  console.log('Generating report...\n');
  
  // Generate report
  const today = new Date().toISOString().split('T')[0];
  const { reportPath, reportContent } = await generateReport(
    topStoriesWithSentiment,
    bestStoriesWithSentiment,
    today
  );
  
  // Print report to stdout
  console.log(reportContent);
  
  // Final success message
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`\n✓ Report generated successfully!`);
  console.log(`  Path: ${reportPath}`);
  console.log(`  Duration: ${duration}s`);
}
