"""Top-level orchestration for the HN sentiment agent."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from rich.console import Console

from .hn_client import HNClient
from .models import FrontPageReport, HNItem, StoryReport
from .sentiment import SentimentAnalyzer

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Tunable parameters for a sentiment analysis run."""

    top_n_stories: int = 10
    max_comments_per_story: int = 20
    max_comment_depth: int = 2
    hn_concurrency: int = 10
    llm_concurrency: int = 5
    model: Optional[str] = None


class SentimentAgent:
    """Orchestrates HN fetching + sentiment analysis into a FrontPageReport."""

    def __init__(
        self,
        *,
        config: Optional[AgentConfig] = None,
        hn_client: Optional[HNClient] = None,
        analyzer: Optional[SentimentAnalyzer] = None,
        console: Optional[Console] = None,
    ) -> None:
        self.config = config or AgentConfig()
        self._external_hn = hn_client is not None
        self._external_analyzer = analyzer is not None
        self._hn = hn_client or HNClient(concurrency=self.config.hn_concurrency)
        self._analyzer = analyzer or SentimentAnalyzer(
            model=self.config.model, concurrency=self.config.llm_concurrency
        )
        self.console = console or Console(stderr=True)

    async def aclose(self) -> None:
        if not self._external_hn:
            await self._hn.aclose()

    async def __aenter__(self) -> "SentimentAgent":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.aclose()

    async def run(self) -> FrontPageReport:
        cfg = self.config
        self.console.log(
            f"Fetching top {cfg.top_n_stories} stories from HackerNews…"
        )
        story_ids = await self._hn.top_story_ids(limit=cfg.top_n_stories)
        if not story_ids:
            self.console.log("[yellow]No story ids returned from HN API.[/yellow]")
            return FrontPageReport()

        stories = await self._hn.get_items(story_ids)
        # Preserve ranking from top_story_ids.
        order = {sid: idx for idx, sid in enumerate(story_ids)}
        stories.sort(key=lambda s: order.get(s.id, 10_000))

        story_reports = await asyncio.gather(
            *(self._analyze_story(story) for story in stories),
            return_exceptions=False,
        )

        report = FrontPageReport(stories=list(story_reports))

        self.console.log("Synthesising front-page overview…")
        report.overall_summary = await self._analyzer.summarize_front_page(report.stories)

        return report

    async def _analyze_story(self, story: HNItem) -> StoryReport:
        cfg = self.config
        self.console.log(f"  • {story.title!r} (id={story.id})")

        comments = await self._hn.collect_comments(
            story,
            max_comments=cfg.max_comments_per_story,
            max_depth=cfg.max_comment_depth,
        )

        if not comments:
            return StoryReport(
                story=story,
                comments_analyzed=0,
                summary="No comments were available to analyse.",
                dominant_sentiment="neutral",
            )

        sentiments = await self._analyzer.classify_comments(
            story=story, comments=comments
        )

        report = StoryReport(
            story=story,
            comments_analyzed=len(comments),
            sentiments=sentiments,
        )

        summary, dominant = await self._analyzer.summarize_story(report)
        report.summary = summary
        report.dominant_sentiment = dominant
        return report
