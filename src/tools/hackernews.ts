// src/tools/hackernews.ts

import axios from 'axios';
import { Story, Comment } from '../types/index.js';

const BASE_URL = 'https://hacker-news.firebaseio.com/v0';

export async function fetchTopStories(): Promise<number[]> {
  try {
    const response = await axios.get<number[]>(`${BASE_URL}/topstories.json`);
    return response.data.slice(0, 10);
  } catch (error) {
    console.error('ERROR [fetchTopStories]:', error);
    return [];
  }
}

export async function fetchBestStories(): Promise<number[]> {
  try {
    const response = await axios.get<number[]>(`${BASE_URL}/beststories.json`);
    return response.data.slice(0, 10);
  } catch (error) {
    console.error('ERROR [fetchBestStories]:', error);
    return [];
  }
}

export async function fetchStory(id: number): Promise<Story | null> {
  try {
    const response = await axios.get<Story>(`${BASE_URL}/item/${id}.json`);
    return response.data;
  } catch (error) {
    console.error(`ERROR [fetchStory ${id}]:`, error);
    return null;
  }
}

export async function fetchComments(storyId: number, commentIds: number[]): Promise<Comment[]> {
  const limitedIds = commentIds.slice(0, 20); // Max 20 comments
  const comments: Comment[] = [];
  
  for (const id of limitedIds) {
    try {
      const response = await axios.get<Comment>(`${BASE_URL}/item/${id}.json`);
      if (response.data && response.data.text) {
        comments.push(response.data);
      }
    } catch (error) {
      console.error(`ERROR [fetchComment ${id}]:`, error);
      // Continue with other comments
    }
  }
  
  return comments;
}
