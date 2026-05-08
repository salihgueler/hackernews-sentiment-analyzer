"""Pydantic data models for HN items, comments, and sentiment reports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

Sentiment = Literal["positive", "neutral", "negative", "mixed"]


class HNItem(BaseModel):
    """A raw item from the HackerNews Firebase API."""

    id: int
    type: Optional[str] = None
    by: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    text: Optional[str] = None
    score: Optional[int] = None
    descendants: Optional[int] = None
    kids: list[int] = Field(default_factory=list)
    parent: Optional[int] = None
    time: Optional[int] = None
    deleted: Optional[bool] = None
    dead: Optional[bool] = None

    @property
    def hn_url(self) -> str:
        return f"https://news.ycombinator.com/item?id={self.id}"

    @property
    def posted_at(self) -> Optional[datetime]:
        if self.time is None:
            return None
        return datetime.fromtimestamp(self.time, tz=timezone.utc)


class CommentSentiment(BaseModel):
    """Sentiment classification for a single comment."""

    comment_id: int
    author: Optional[str] = None
    sentiment: Sentiment
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = ""
    excerpt: str = ""


class StoryReport(BaseModel):
    """Aggregated sentiment analysis for a single HN story."""

    story: HNItem
    comments_analyzed: int
    sentiments: list[CommentSentiment] = Field(default_factory=list)
    summary: str = ""
    dominant_sentiment: Sentiment = "neutral"

    @property
    def sentiment_breakdown(self) -> dict[str, int]:
        counts = {"positive": 0, "neutral": 0, "negative": 0, "mixed": 0}
        for s in self.sentiments:
            counts[s.sentiment] = counts.get(s.sentiment, 0) + 1
        return counts

    @property
    def sentiment_score(self) -> float:
        """A normalized score in [-1, 1] based on positive vs negative share."""
        if not self.sentiments:
            return 0.0
        weights = {"positive": 1.0, "neutral": 0.0, "negative": -1.0, "mixed": 0.0}
        total = sum(weights[s.sentiment] * s.confidence for s in self.sentiments)
        return round(total / len(self.sentiments), 3)


class FrontPageReport(BaseModel):
    """Sentiment report across the full HackerNews front page."""

    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    stories: list[StoryReport] = Field(default_factory=list)
    overall_summary: str = ""

    @property
    def total_comments_analyzed(self) -> int:
        return sum(s.comments_analyzed for s in self.stories)

    @property
    def aggregate_breakdown(self) -> dict[str, int]:
        counts = {"positive": 0, "neutral": 0, "negative": 0, "mixed": 0}
        for story in self.stories:
            for key, value in story.sentiment_breakdown.items():
                counts[key] += value
        return counts
