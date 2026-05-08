"""Command-line entry point for the HN sentiment agent."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from rich.console import Console

from .agent import AgentConfig, SentimentAgent
from .report import render_console, render_markdown


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="hn-sentiment",
        description=(
            "Monitor the HackerNews front page, classify the comment sentiment, "
            "and emit a report."
        ),
    )
    parser.add_argument(
        "-n",
        "--top-stories",
        type=int,
        default=10,
        help="Number of front-page stories to analyse (default: 10).",
    )
    parser.add_argument(
        "-c",
        "--max-comments",
        type=int,
        default=20,
        help="Maximum comments to analyse per story (default: 20).",
    )
    parser.add_argument(
        "--depth",
        type=int,
        default=2,
        help="Maximum comment tree depth to traverse (default: 2).",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Override the LLM model (defaults to OPENAI_MODEL or gpt-4o-mini).",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Optional path for a Markdown report (directory or .md file).",
    )
    parser.add_argument(
        "--json",
        dest="json_output",
        type=Path,
        default=None,
        help="Optional path to dump the raw report as JSON.",
    )
    parser.add_argument(
        "--no-console",
        action="store_true",
        help="Suppress the rich console rendering (useful for scripted runs).",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable debug logging.",
    )
    return parser.parse_args(argv)


def _resolve_markdown_path(output: Path) -> Path:
    if output.suffix.lower() == ".md":
        output.parent.mkdir(parents=True, exist_ok=True)
        return output
    output.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return output / f"hn-sentiment-{timestamp}.md"


async def _run(args: argparse.Namespace) -> int:
    config = AgentConfig(
        top_n_stories=args.top_stories,
        max_comments_per_story=args.max_comments,
        max_comment_depth=args.depth,
        model=args.model,
    )

    stderr_console = Console(stderr=True)
    stdout_console = Console()

    async with SentimentAgent(config=config, console=stderr_console) as agent:
        report = await agent.run()

    if not args.no_console:
        render_console(report, console=stdout_console)

    if args.output:
        md_path = _resolve_markdown_path(args.output)
        md_path.write_text(render_markdown(report), encoding="utf-8")
        stderr_console.log(f"[green]Markdown report written to {md_path}[/green]")

    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(
            report.model_dump_json(indent=2), encoding="utf-8"
        )
        stderr_console.log(f"[green]JSON report written to {args.json_output}[/green]")

    return 0


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
    try:
        return asyncio.run(_run(args))
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
