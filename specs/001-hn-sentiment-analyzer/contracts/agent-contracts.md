# Agent Contracts

**Date**: 2026-03-10  
**Feature**: 001-hn-sentiment-analyzer

## Overview

This document defines the contracts between agents in the HackerNews Daily Intelligence system. All agents communicate via structured TypeScript types.

---

## Main Agent → Sentiment Subagent

**Purpose**: Request sentiment analysis for a story's comments

**Input Contract**:
```typescript
{
  story: Story;
  comments: Comment[];
}
```

**Output Contract**:
```typescript
{
  storyId: number;
  sentiment: SentimentResult;
}
```

**Behavior**:
- If `comments` array is empty, return `{ label: "No sentiment", confidence: 0 }`
- Aggregate all comment text for LLM analysis
- Parse LLM response into SentimentResult format
- Handle LLM errors by logging to stderr and returning neutral sentiment with low confidence

---

## Main Agent → Summary Subagent

**Purpose**: Generate Markdown report from analyzed stories

**Input Contract**:
```typescript
{
  topStories: Story[]; // 10 stories with sentiment populated
  bestStories: Story[]; // 10 stories with sentiment populated
  date: string; // ISO date string YYYY-MM-DD
}
```

**Output Contract**:
```typescript
{
  reportPath: string; // Path to generated report file
  reportContent: string; // Markdown content
}
```

**Behavior**:
- Create `output/` directory if missing
- Generate Markdown with two sections (Top Stories, Best Stories)
- Write to `output/report.md`
- Return both file path and content for stdout printing

---

## HackerNews API Tool Contracts

### fetchTopStories()

**Output**:
```typescript
number[] // Array of story IDs
```

**Errors**: Logs to stderr, returns empty array on failure

---

### fetchBestStories()

**Output**:
```typescript
number[] // Array of story IDs
```

**Errors**: Logs to stderr, returns empty array on failure

---

### fetchStory(id: number)

**Output**:
```typescript
Story | null
```

**Errors**: Logs to stderr, returns null on failure

---

### fetchComments(storyId: number, commentIds: number[])

**Input**: Story ID and array of comment IDs (max 20)

**Output**:
```typescript
Comment[] // Array of successfully fetched comments
```

**Errors**: Logs to stderr for individual failures, returns partial results

---

## Error Handling Contract

All agents and tools MUST:
- Log errors to stderr with format: `ERROR [component]: message`
- Continue processing remaining items on partial failures
- Return typed results (never throw unhandled exceptions to main)
- Use optional fields (`?`) for data that may be missing due to errors
