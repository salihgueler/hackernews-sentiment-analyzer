# HackerNews Sentiment Analyzer

An autonomous agent that monitors the HackerNews front page, reads the comments
on each story, and produces a structured sentiment report — both a rich
terminal view and an optional Markdown / JSON artifact for downstream pipelines.

## What it does

1. Pulls the top N stories from the official [HackerNews Firebase
   API](https://github.com/HackerNews/API).
2. Walks each story's comment tree (BFS, configurable depth and count).
3. Classifies every comment with an LLM into `positive`, `neutral`, `negative`,
   or `mixed`, with a confidence score and a short rationale.
4. Synthesises per-story summaries and an overall front-page "daily brief".
5. Renders the result to the terminal and, optionally, to Markdown / JSON.

The agent is fully async — HN fetches and LLM calls both run concurrently with
bounded parallelism and automatic retries.

## Install

Requires Python 3.10+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Or install it as a package so the `hn-sentiment` script is on your PATH:

```bash
pip install -e .
```

## Configure

Copy the example env file and add your OpenAI key:

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY
```

Supported environment variables:

| Variable          | Purpose                                                 |
| ----------------- | ------------------------------------------------------- |
| `OPENAI_API_KEY`  | Required. Used for sentiment classification + summary.  |
| `OPENAI_MODEL`    | Optional. Defaults to `gpt-4o-mini`.                    |
| `OPENAI_BASE_URL` | Optional. Point at Azure OpenAI, OpenRouter, or Ollama. |

Any OpenAI-compatible endpoint that supports chat completions with
`response_format: json_object` will work.

## Run

Quick run with defaults (10 stories, up to 20 comments each, depth 2):

```bash
hn-sentiment
```

Or without installing the script:

```bash
python -m hn_sentiment.cli
```

Options:

```bash
hn-sentiment \
  --top-stories 15 \
  --max-comments 30 \
  --depth 2 \
  --model gpt-4o-mini \
  --output reports/ \
  --json reports/latest.json
```

- `--output` can be a directory (a timestamped `.md` file is created) or a
  specific `.md` path.
- `--json` writes the full structured report for programmatic use.
- `--no-console` suppresses the rich terminal view (useful in CI / cron).
- `-v` turns on debug logging.

## Output

Terminal output includes:

- A header banner with counts and aggregate sentiment breakdown.
- A "Daily Brief" panel with the LLM's overall synthesis.
- A per-story table showing dominant sentiment, a normalized `-1..+1` score,
  and the positive/neutral/mixed/negative splits.
- Per-story panels with the narrative summary.

The Markdown report adds a `<details>` block per story with every analysed
comment, its sentiment, confidence, and a short rationale.

## Using it as a library

```python
import asyncio
from hn_sentiment import SentimentAgent
from hn_sentiment.agent import AgentConfig

async def main():
    async with SentimentAgent(config=AgentConfig(top_n_stories=5)) as agent:
        report = await agent.run()
    print(report.aggregate_breakdown)
    for story in report.stories:
        print(story.story.title, story.dominant_sentiment, story.sentiment_score)

asyncio.run(main())
```

`report` is a Pydantic model — call `report.model_dump_json(indent=2)` or
`report.model_dump()` to serialize.

## Scheduling

To monitor the front page on a schedule, drop this into cron or a launchd plist:

```bash
0 * * * * cd /path/to/hackernews-sentiment-analyzer && \
  .venv/bin/hn-sentiment --no-console --output reports/ --json reports/latest.json
```

## Project layout

```
src/hn_sentiment/
  __init__.py      # public exports
  models.py        # pydantic models (HNItem, CommentSentiment, reports)
  hn_client.py     # async HN Firebase API client
  sentiment.py     # LLM-backed comment classifier + summarizers
  agent.py         # orchestration (SentimentAgent, AgentConfig)
  report.py        # rich console + markdown renderers
  cli.py           # argparse CLI entry point
```

## Notes and caveats

- The HN API is unauthenticated and public, but the agent still uses bounded
  concurrency and exponential-backoff retries to stay polite.
- LLM sentiment analysis is probabilistic. Rationales and confidences are meant
  as explainability aids, not ground truth.
- Comments are HTML-stripped and truncated to 1200 characters before being
  sent to the model, which keeps token usage predictable.
- Deleted, flagged (`dead`), or empty comments are silently skipped.
