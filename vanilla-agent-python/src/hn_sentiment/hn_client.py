"""Async client for the HackerNews Firebase API.

Docs: https://github.com/HackerNews/API
"""

from __future__ import annotations

import asyncio
import logging
from typing import Iterable, Optional

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .models import HNItem

logger = logging.getLogger(__name__)

HN_API_BASE = "https://hacker-news.firebaseio.com/v0"


class HNClient:
    """Lightweight async client for fetching HN stories and comments."""

    def __init__(
        self,
        *,
        client: Optional[httpx.AsyncClient] = None,
        concurrency: int = 10,
        timeout: float = 15.0,
    ) -> None:
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            base_url=HN_API_BASE,
            timeout=timeout,
            headers={"User-Agent": "hn-sentiment-analyzer/0.1"},
        )
        self._semaphore = asyncio.Semaphore(concurrency)

    async def __aenter__(self) -> "HNClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _get_json(self, path: str) -> Optional[dict]:
        async for attempt in AsyncRetrying(
            reraise=True,
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
            retry=retry_if_exception_type(
                (httpx.TransportError, httpx.HTTPStatusError)
            ),
        ):
            with attempt:
                async with self._semaphore:
                    resp = await self._client.get(path)
                    resp.raise_for_status()
                    return resp.json()
        return None

    async def top_story_ids(self, limit: int = 30) -> list[int]:
        """Return the top `limit` story IDs from the HN front page."""
        data = await self._get_json("/topstories.json")
        if not isinstance(data, list):
            return []
        return data[:limit]

    async def get_item(self, item_id: int) -> Optional[HNItem]:
        raw = await self._get_json(f"/item/{item_id}.json")
        if not raw:
            return None
        try:
            return HNItem.model_validate(raw)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to parse HN item %s: %s", item_id, exc)
            return None

    async def get_items(self, item_ids: Iterable[int]) -> list[HNItem]:
        tasks = [self.get_item(i) for i in item_ids]
        results = await asyncio.gather(*tasks, return_exceptions=False)
        return [r for r in results if r is not None]

    async def collect_comments(
        self,
        story: HNItem,
        *,
        max_comments: int = 40,
        max_depth: int = 2,
    ) -> list[HNItem]:
        """Breadth-first collection of comments under a story.

        Skips deleted/dead entries and stops once `max_comments` are gathered.
        """
        collected: list[HNItem] = []
        frontier: list[tuple[int, int]] = [(kid, 0) for kid in story.kids]

        while frontier and len(collected) < max_comments:
            # Fetch this layer in parallel for speed.
            layer = frontier[: max_comments - len(collected)]
            frontier = frontier[len(layer) :]

            items = await asyncio.gather(
                *(self.get_item(item_id) for item_id, _ in layer),
                return_exceptions=False,
            )

            for (item_id, depth), item in zip(layer, items):
                if item is None or item.deleted or item.dead:
                    continue
                if item.type != "comment" or not item.text:
                    continue
                collected.append(item)
                if depth + 1 < max_depth and item.kids:
                    frontier.extend((kid, depth + 1) for kid in item.kids)

        return collected
