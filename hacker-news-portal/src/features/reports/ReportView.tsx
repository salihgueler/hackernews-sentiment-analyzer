import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { useParams } from "react-router-dom";

import { displayTitle } from "../../domain/reportMetadata";
import { MarkdownRenderer } from "../../markdown/MarkdownRenderer";
import { BackendError, getReport, listReports } from "../../wireBackend";
import type { ReportMetadata, ReportPayload } from "../../wireBackend";
import { NotFoundView } from "./NotFoundView";

// ---------------------------------------------------------------------------
// ReportView — main-view surface for `/reports/:slug` and, via the landing
// route, for `/` with the latest report's slug threaded in as a prop.
//
// Slug resolution: the `slug` prop takes precedence so the landing route can
// pass the latest slug without changing the URL (Req 1.1). When the prop is
// absent, the slug is read from `useParams()` for the `/reports/:slug`
// route. If neither source yields a slug, the view renders `NotFoundView`.
//
// Data flow: the backend call is `listReports` + `getReport(slug)` in
// parallel via `Promise.all`. `listReports` provides the siblings array
// `displayTitle` needs for the "same generatedAt, empty title" tie-breaker
// branch of the fallback title logic (Req 4.2, 4.3). Every request is keyed
// on the slug so a navigation to a different slug discards in-flight
// responses for the previous slug (Req 3.3, 15.2).
//
// Error mapping:
//   - `NOT_FOUND` from `getReport` → render `<NotFoundView slug={slug} />`
//     (Req 3.4). The Sidebar stays rendered because it is a sibling in
//     `Layout`; this component is not responsible for it.
//   - `DATA_SOURCE_UNAVAILABLE` from either call → render a
//     `<p role="alert">Report could not be loaded.</p>` banner (Req 1.5). The
//     Sidebar stays rendered for the same reason.
//
// Realizes design Property 5 (route resolution).
// ---------------------------------------------------------------------------

export interface ReportViewProps {
  readonly slug?: string;
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

export function ReportView({ slug: slugProp }: ReportViewProps): ReactElement {
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
        // Any other class of error (should not occur for read paths, but we
        // refuse to crash the main view): degrade to "unavailable" so the
        // Sidebar stays usable and the Visitor sees a recognizable message.
        setState({ kind: "unavailable" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.kind === "loading") {
    return (
      <section style={sectionStyle}>
        <p style={placeholderStyle}>Loading report…</p>
      </section>
    );
  }

  if (state.kind === "notFound") {
    return <NotFoundView slug={slug} />;
  }

  if (state.kind === "unavailable") {
    return (
      <section style={sectionStyle}>
        <p role="alert" style={alertStyle}>
          Report could not be loaded.
        </p>
      </section>
    );
  }

  const { payload, siblings } = state;
  const { metadata, body } = payload;
  const title = displayTitle(metadata, siblings);

  return (
    <article style={articleStyle}>
      <header style={headerStyle}>
        <h2 style={headingStyle}>{title}</h2>
        <time dateTime={metadata.generatedAt} style={dateStyle}>
          {metadata.generatedAt}
        </time>
      </header>
      <MarkdownRenderer>{body}</MarkdownRenderer>
    </article>
  );
}

export default ReportView;

// ---------------------------------------------------------------------------
// Inline styles, token-driven.
// ---------------------------------------------------------------------------

const sectionStyle: CSSProperties = {
  padding: "var(--space-4)",
};

const articleStyle: CSSProperties = {
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--font-size-heading)",
};

const dateStyle: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-small)",
};

const placeholderStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
};

const alertStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text)",
};
