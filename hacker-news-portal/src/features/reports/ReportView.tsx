import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";

import { displayTitle } from "../../domain/reportMetadata";
import { MarkdownRenderer } from "../../markdown/MarkdownRenderer";
import {
  BackendError,
  getReport,
  getReportBody,
  listReports,
} from "../../wireBackend";
import type { ReportMetadata, ReportPayload } from "../../wireBackend";
import { Chip } from "../../ui/Chip";
import type { ChipTone } from "../../ui/Chip";
import { Skeleton } from "../../ui/Skeleton";
import { NotFoundView } from "./NotFoundView";

import "./ReportView.css";

// ---------------------------------------------------------------------------
// ReportView — main-view surface for `/reports/:slug` and, via the landing
// route, for `/` with the latest report's slug threaded in as a prop.
//
// Slug resolution: the `slug` prop takes precedence so the landing route can
// pass the latest slug without changing the URL (Req 1.1). When the prop is
// absent, the slug is read from `useParams()` for the `/reports/:slug`
// route. If neither source yields a slug, the view renders `NotFoundView`.
//
// Data flow (two paths):
//   - Fast path (landing): the parent has already resolved the selected
//     `ReportMetadata` and passes it as `initialMetadata`. In that case we
//     fetch only the Markdown body via `getReportBody(slug)` and use
//     `[initialMetadata]` as the siblings set; `displayTitle` only needs
//     siblings when the title is empty and collides on `generatedAt`, so a
//     single-element array is a safe seed for the landing render.
//   - Direct-URL path (`/reports/:slug`): no `initialMetadata` is
//     available, so we fall back to `Promise.all([getReport(slug),
//     listReports()])` to get the full sibling set for the display-title
//     fallback (Req 4.2, 4.3). The static-backend module cache
//     deduplicates so subsequent navigations within the same session
//     still only pay one HTTP round-trip per resource.
//
// Every request is keyed on the slug so a navigation to a different slug
// discards in-flight responses for the previous slug (Req 3.3, 15.2).
//
// Error mapping:
//   - `NOT_FOUND` from `getReport` → render `<NotFoundView slug={slug} />`
//     (Req 3.4). The Sidebar stays rendered because it is a sibling in
//     `Layout`.
//   - `DATA_SOURCE_UNAVAILABLE` from either call → render a
//     `<p role="alert">Report could not be loaded.</p>` banner (Req 1.5).
//
// Rendering: the article uses a display-serif <h1>, a mono <time> row
// below a hairline rule, and an optional sentiment `<Chip>` row that
// only appears when the caller-supplied `ReportMetadata` carries a
// known `sentiment` value. Today no agent writes that field so the chip
// row is inert; the wiring is in place for the next time the agent
// schema grows.
//
// Realizes design Property 5 (route resolution).
// ---------------------------------------------------------------------------

export interface ReportViewProps {
  readonly slug?: string;
  readonly initialMetadata?: ReportMetadata;
}

type ViewState =
  | { readonly kind: "loading" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" }
  | {
      readonly kind: "ready";
      readonly payload: ReportPayload;
      readonly siblings: ReadonlyArray<ReportMetadata>;
    };

export function ReportView({
  slug: slugProp,
  initialMetadata,
}: ReportViewProps): ReactElement {
  const params = useParams();
  const slug = slugProp ?? params.slug;

  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    if (slug === undefined || slug.length === 0) {
      setState({ kind: "notFound" });
      return;
    }

    let cancelled = false;
    setState({ kind: "loading" });

    if (initialMetadata !== undefined && initialMetadata.slug === slug) {
      getReportBody(slug).then(
        (body) => {
          if (cancelled) return;
          setState({
            kind: "ready",
            payload: { metadata: initialMetadata, body },
            siblings: [initialMetadata],
          });
        },
        (err: unknown) => {
          if (cancelled) return;
          if (
            err instanceof BackendError &&
            err.code === "DATA_SOURCE_UNAVAILABLE"
          ) {
            setState({ kind: "unavailable" });
            return;
          }
          setState({ kind: "unavailable" });
        },
      );
      return () => {
        cancelled = true;
      };
    }

    Promise.all([getReport(slug), listReports()]).then(
      ([payload, siblings]) => {
        if (cancelled) return;
        setState({ kind: "ready", payload, siblings });
      },
      (err: unknown) => {
        if (cancelled) return;
        if (err instanceof BackendError && err.code === "NOT_FOUND") {
          setState({ kind: "notFound" });
          return;
        }
        if (
          err instanceof BackendError &&
          err.code === "DATA_SOURCE_UNAVAILABLE"
        ) {
          setState({ kind: "unavailable" });
          return;
        }
        setState({ kind: "unavailable" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [slug, initialMetadata]);

  if (state.kind === "loading") {
    return REPORT_LOADING_PLACEHOLDER;
  }

  if (state.kind === "notFound") {
    return slug !== undefined ? <NotFoundView slug={slug} /> : <NotFoundView />;
  }

  if (state.kind === "unavailable") {
    return (
      <article className="report-view">
        <p role="alert" className="report-view__error">
          Report could not be loaded.
        </p>
      </article>
    );
  }

  const { payload, siblings } = state;
  const { metadata, body } = payload;
  const title = displayTitle(metadata, siblings);
  const sentimentTone = pickSentimentTone(metadata);

  return (
    <article className="report-view">
      <header className="report-view__header">
        <h1 className="report-view__title">{title}</h1>
        <div className="report-view__meta">
          <time dateTime={metadata.generatedAt}>{metadata.generatedAt}</time>
          <span aria-hidden="true">·</span>
          <span>{metadata.slug}</span>
        </div>
        {sentimentTone !== undefined ? (
          <div className="report-view__chips">
            <Chip tone={sentimentTone}>Sentiment: {sentimentTone}</Chip>
          </div>
        ) : null}
      </header>
      <MarkdownRenderer>{body}</MarkdownRenderer>
    </article>
  );
}

export default ReportView;

// ---------------------------------------------------------------------------
// Sentiment selection. The `ReportMetadata` schema does not currently
// carry a sentiment field, so this helper treats every entry as
// sentiment-less and returns `undefined`. Adding a `sentiment` field in
// a future agent schema lets this helper start surfacing a chip without
// touching the render tree.
// ---------------------------------------------------------------------------

const KNOWN_TONES: ReadonlyArray<ChipTone> = [
  "positive",
  "negative",
  "mixed",
  "neutral",
];

function pickSentimentTone(metadata: ReportMetadata): ChipTone | undefined {
  const candidate = (metadata as { sentiment?: unknown }).sentiment;
  if (typeof candidate !== "string") {
    return undefined;
  }
  return KNOWN_TONES.find((tone) => tone === candidate);
}

// ---------------------------------------------------------------------------
// Hoisted loading placeholder (rendering-hoist-jsx). Shape mirrors the
// final article: large heading line, meta line, body lines.
// ---------------------------------------------------------------------------

const REPORT_LOADING_PLACEHOLDER: ReactElement = (
  <article className="report-view" aria-busy="true">
    <header className="report-view__header">
      <Skeleton variant="line" width="70%" height="2.75rem" />
      <Skeleton variant="line" width="40%" />
    </header>
    <div className="report-view__skeletons">
      <div className="report-view__skeleton-body">
        <Skeleton variant="line" />
        <Skeleton variant="line" width="95%" />
        <Skeleton variant="line" width="88%" />
        <Skeleton variant="line" width="60%" />
      </div>
    </div>
  </article>
);
