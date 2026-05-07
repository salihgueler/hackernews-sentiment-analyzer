"""LLM-backed sentiment analyzer for HackerNews comments."""

from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
from typing import Iterable, Optional

from openai import AsyncOpenAI
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .models import CommentSentiment, HNItem, Sentiment, StoryReport

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"

_TAG_RE = re.compile(r"<[^>]+>")

_SYSTEM_PROMPT = """You are an expert discourse analyst specialising in developer communities.
You read HackerNews comments and classify the commenter's sentiment toward the
submitted story (its subject, claims, or authors) with calibrated confidence.

Sentiment labels:
- positive: the commenter broadly agrees, praises, or expresses enthusiasm.
- negative: the commenter disagrees, criticises, or expresses frustration.
- neutral: factual, clarifying, or off-topic without strong valence.
- mixed: substantive praise and criticism together.

Keep rationales under 25 words. Never invent content not present in the comment."""


class SentimentAnalyzer:
    """Classify HN comments using an OpenAI-compatible chat model."""

    def __init__(
        self,
        *,
        client: Optional[AsyncOpenAI] = None,
        model: Optional[str] = None,
        concurrency: int = 5,
    ) -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        if client is None:
            if not api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY is not set. Export it or add it to a .env file."
                )
            client_kwargs: dict = {"api_key": api_key}
            if base_url:
                client_kwargs["base_url"] = base_url
            client = AsyncOpenAI(**client_kwargs)
        self._client = client
        self._model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
        self._semaphore = asyncio.Semaphore(concurrency)

    @staticmethod
    def _clean(text: str, *, limit: int = 1200) -> str:
        """Strip HN's HTML markup down to readable plain text."""
        if not text:
            return ""
        unescaped = html.unescape(text)
        no_tags = _TAG_RE.sub(" ", unescaped)
        collapsed = re.sub(r"\s+", " ", no_tags).strip()
        if len(collapsed) > limit:
            collapsed = collapsed[: limit - 1].rstrip() + "…"
        return collapsed

    async def _chat_json(self, messages: list[dict], *, max_tokens: int = 400) -> dict:
        async for attempt in AsyncRetrying(
            reraise=True,
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=8),
            retry=retry_if_exception_type(Exception),
        ):
            with attempt:
                async with self._semaphore:
                    resp = await self._client.chat.completions.create(
                        model=self._model,
                        messages=messages,
                        response_format={"type": "json_object"},
                        temperature=0.2,
                        max_tokens=max_tokens,
                    )
                content = resp.choices[0].message.content or "{}"
                return json.loads(content)
        return {}

    async def classify_comment(
        self, *, story: HNItem, comment: HNItem
    ) -> CommentSentiment:
        excerpt = self._clean(comment.text or "")
        story_title = story.title or "(untitled story)"

        user_prompt = (
            f"Story title: {story_title}\n"
            f"Story URL: {story.url or story.hn_url}\n\n"
            f"Comment by {comment.by or 'unknown'}:\n"
            f'"""\n{excerpt}\n"""\n\n'
            "Respond as JSON with keys: sentiment (positive|neutral|negative|mixed), "
            "confidence (0-1 float), rationale (short string)."
        )

        try:
            data = await self._chat_json(
                [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ]
            )
        except Exception as exc:
            logger.warning("Sentiment call failed for comment %s: %s", comment.id, exc)
            data = {}

        sentiment = _coerce_sentiment(data.get("sentiment"))
        confidence = _coerce_confidence(data.get("confidence"))
        rationale = str(data.get("rationale") or "").strip()

        return CommentSentiment(
            comment_id=comment.id,
            author=comment.by,
            sentiment=sentiment,
            confidence=confidence,
            rationale=rationale,
            excerpt=excerpt[:280],
        )

    async def classify_comments(
        self, *, story: HNItem, comments: Iterable[HNItem]
    ) -> list[CommentSentiment]:
        tasks = [self.classify_comment(story=story, comment=c) for c in comments]
        return list(await asyncio.gather(*tasks))

    async def summarize_story(self, report: StoryReport) -> tuple[str, Sentiment]:
        """Produce a 2-3 sentence summary and overall label for a story's comments."""
        if not report.sentiments:
            return ("No comments were available to analyse.", "neutral")

        breakdown = report.sentiment_breakdown
        dominant = max(breakdown, key=breakdown.get)
        if breakdown[dominant] == 0:
            dominant = "neutral"

        # Pick a handful of representative excerpts across labels.
        samples: list[str] = []
        for label in ("positive", "negative", "mixed", "neutral"):
            for s in report.sentiments:
                if s.sentiment == label and s.excerpt:
                    samples.append(f"[{label}] {s.excerpt}")
                    break
            if len(samples) >= 4:
                break

        prompt = (
            f"Story: {report.story.title or '(untitled)'}\n"
            f"Comments analysed: {report.comments_analyzed}\n"
            f"Sentiment breakdown: {breakdown}\n\n"
            "Representative comments:\n"
            + "\n".join(f"- {s}" for s in samples)
            + "\n\nReturn JSON with keys: summary (2-3 sentences describing the "
            "community reaction, tensions, and recurring themes) and "
            "dominant_sentiment (positive|neutral|negative|mixed)."
        )

        try:
            data = await self._chat_json(
                [
                    {
                        "role": "system",
                        "content": "You write crisp, neutral analyst briefings.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=300,
            )
        except Exception as exc:
            logger.warning("Story summary failed for %s: %s", report.story.id, exc)
            return (
                f"Mixed reactions with {breakdown['positive']} positive, "
                f"{breakdown['negative']} negative, and {breakdown['neutral']} neutral comments.",
                _coerce_sentiment(dominant),
            )

        summary = str(data.get("summary") or "").strip()
        label = _coerce_sentiment(data.get("dominant_sentiment") or dominant)
        return summary or "No summary produced.", label

    async def summarize_front_page(
        self, story_reports: list[StoryReport]
    ) -> str:
        """Write an overall front-page mood summary."""
        if not story_reports:
            return "No stories were analysed."

        bullets: list[str] = []
        for sr in story_reports:
            bullets.append(
                f"- {sr.story.title!r}: {sr.dominant_sentiment} "
                f"(score {sr.sentiment_score}, {sr.comments_analyzed} comments) — {sr.summary}"
            )

        prompt = (
            "You have per-story sentiment summaries for today's HackerNews front page. "
            "Write a 4-6 sentence executive brief covering the overall community mood, "
            "notable themes across stories, and any stories with unusually polarised "
            "reactions. Return JSON with a single key 'overview'.\n\n"
            + "\n".join(bullets)
        )

        try:
            data = await self._chat_json(
                [
                    {
                        "role": "system",
                        "content": "You write concise daily intelligence briefs.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=400,
            )
        except Exception as exc:
            logger.warning("Front page summary failed: %s", exc)
            return "Unable to synthesise an overall summary."

        return str(data.get("overview") or "").strip() or "No overview produced."


def _coerce_sentiment(value: object) -> Sentiment:
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"positive", "neutral", "negative", "mixed"}:
            return lowered  # type: ignore[return-value]
    return "neutral"


def _coerce_confidence(value: object) -> float:
    try:
        f = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.5
    if f < 0:
        return 0.0
    if f > 1:
        # Allow models that return 0-100 scale.
        return min(f / 100.0, 1.0) if f <= 100 else 1.0
    return f
