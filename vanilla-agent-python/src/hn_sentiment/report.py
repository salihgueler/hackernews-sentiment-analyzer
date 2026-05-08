"""Rendering helpers for sentiment reports (console + markdown)."""

from __future__ import annotations

from io import StringIO

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .models import FrontPageReport, StoryReport

_SENTIMENT_COLORS = {
    "positive": "green",
    "negative": "red",
    "neutral": "cyan",
    "mixed": "yellow",
}


def render_console(report: FrontPageReport, console: Console | None = None) -> None:
    """Print a human-friendly report to the terminal."""
    console = console or Console()

    header = Text()
    header.append("HackerNews Sentiment Report\n", style="bold magenta")
    header.append(
        f"Generated: {report.generated_at.isoformat(timespec='seconds')}\n",
        style="dim",
    )
    header.append(
        f"Stories: {len(report.stories)}  |  "
        f"Comments analysed: {report.total_comments_analyzed}\n",
        style="dim",
    )
    breakdown = report.aggregate_breakdown
    header.append("Overall breakdown: ", style="bold")
    for label in ("positive", "neutral", "mixed", "negative"):
        header.append(
            f"{label}={breakdown[label]}  ", style=_SENTIMENT_COLORS[label]
        )
    console.print(Panel(header, border_style="magenta"))

    if report.overall_summary:
        console.print(Panel(report.overall_summary, title="Daily Brief", border_style="cyan"))

    table = Table(title="Per-story sentiment", show_lines=False, expand=True)
    table.add_column("#", justify="right", style="dim", width=3)
    table.add_column("Story", overflow="fold")
    table.add_column("Dominant", width=10)
    table.add_column("Score", justify="right", width=7)
    table.add_column("Pos", justify="right", width=5)
    table.add_column("Neu", justify="right", width=5)
    table.add_column("Mix", justify="right", width=5)
    table.add_column("Neg", justify="right", width=5)
    table.add_column("Comments", justify="right", width=8)

    for idx, story_report in enumerate(report.stories, start=1):
        bd = story_report.sentiment_breakdown
        table.add_row(
            str(idx),
            _story_cell(story_report),
            Text(
                story_report.dominant_sentiment,
                style=_SENTIMENT_COLORS[story_report.dominant_sentiment],
            ),
            f"{story_report.sentiment_score:+.2f}",
            str(bd["positive"]),
            str(bd["neutral"]),
            str(bd["mixed"]),
            str(bd["negative"]),
            str(story_report.comments_analyzed),
        )

    console.print(table)

    for idx, story_report in enumerate(report.stories, start=1):
        if not story_report.summary:
            continue
        title = f"{idx}. {story_report.story.title or '(untitled)'}"
        console.print(
            Panel(
                story_report.summary,
                title=title,
                subtitle=story_report.story.hn_url,
                border_style=_SENTIMENT_COLORS[story_report.dominant_sentiment],
            )
        )


def _story_cell(story_report: StoryReport) -> Text:
    title = story_report.story.title or "(untitled)"
    txt = Text()
    txt.append(title + "\n", style="bold")
    txt.append(story_report.story.hn_url, style="dim underline")
    return txt


def render_markdown(report: FrontPageReport) -> str:
    """Render a Markdown version of the report for persistence."""
    buf = StringIO()
    buf.write("# HackerNews Sentiment Report\n\n")
    buf.write(f"- **Generated:** {report.generated_at.isoformat(timespec='seconds')}\n")
    buf.write(f"- **Stories analysed:** {len(report.stories)}\n")
    buf.write(f"- **Comments analysed:** {report.total_comments_analyzed}\n")

    breakdown = report.aggregate_breakdown
    buf.write(
        "- **Overall breakdown:** "
        f"positive={breakdown['positive']}, neutral={breakdown['neutral']}, "
        f"mixed={breakdown['mixed']}, negative={breakdown['negative']}\n\n"
    )

    if report.overall_summary:
        buf.write("## Daily Brief\n\n")
        buf.write(report.overall_summary.strip() + "\n\n")

    buf.write("## Stories\n\n")
    buf.write(
        "| # | Story | Dominant | Score | Pos | Neu | Mix | Neg | Comments |\n"
        "|---|-------|----------|-------|-----|-----|-----|-----|----------|\n"
    )
    for idx, sr in enumerate(report.stories, start=1):
        bd = sr.sentiment_breakdown
        title = (sr.story.title or "(untitled)").replace("|", "\\|")
        buf.write(
            f"| {idx} | [{title}]({sr.story.hn_url}) | {sr.dominant_sentiment} | "
            f"{sr.sentiment_score:+.2f} | {bd['positive']} | {bd['neutral']} | "
            f"{bd['mixed']} | {bd['negative']} | {sr.comments_analyzed} |\n"
        )
    buf.write("\n")

    for idx, sr in enumerate(report.stories, start=1):
        buf.write(f"### {idx}. {sr.story.title or '(untitled)'}\n\n")
        buf.write(f"- Link: {sr.story.hn_url}\n")
        if sr.story.url:
            buf.write(f"- External: {sr.story.url}\n")
        if sr.story.score is not None:
            buf.write(f"- HN score: {sr.story.score}\n")
        buf.write(f"- Dominant sentiment: **{sr.dominant_sentiment}** "
                  f"(score {sr.sentiment_score:+.2f})\n\n")
        if sr.summary:
            buf.write(sr.summary.strip() + "\n\n")

        if sr.sentiments:
            buf.write("<details><summary>Comment-level sentiments</summary>\n\n")
            for cs in sr.sentiments:
                excerpt = cs.excerpt.replace("\n", " ")
                buf.write(
                    f"- **{cs.sentiment}** ({cs.confidence:.2f}) "
                    f"by `{cs.author or 'unknown'}`: {cs.rationale}\n"
                    f"  > {excerpt}\n"
                )
            buf.write("\n</details>\n\n")

    return buf.getvalue()
