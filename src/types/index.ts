// src/types/index.ts

export type Story = {
  id: number;
  title: string;
  url?: string;
  score: number;
  by?: string;
  time: number;
  kids?: number[];
  sentiment?: SentimentResult;
};

export type Comment = {
  id: number;
  text: string;
  by?: string;
  parent: number;
};

export type SentimentResult = {
  label: "positive" | "negative" | "neutral" | "No sentiment";
  confidence: number; // 0-100
};

export type StoryWithComments = Story & {
  comments: Comment[];
};
