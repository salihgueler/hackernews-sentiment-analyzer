import type { CSSProperties, ReactElement } from "react";

// ---------------------------------------------------------------------------
// NotFoundView — main-view surface for the "slug not in Report_Index"
// branch (Req 3.4) and the catch-all `*` route. The Sidebar is always
// rendered alongside because it is a sibling of the main view in
// `Layout`; this component's only responsibility is the main-view
// message (Req 3.4 last clause).
//
// When rendered under `/reports/:slug` for an unknown slug, `slug` is
// threaded through from `ReportView` so the message can echo the URL the
// Visitor tried. When rendered under the catch-all route, `slug` is
// omitted and the message degrades gracefully.
// ---------------------------------------------------------------------------

export interface NotFoundViewProps {
  readonly slug?: string;
}

export function NotFoundView({ slug }: NotFoundViewProps): ReactElement {
  const bodyText =
    slug !== undefined && slug.length > 0
      ? `No report exists at /reports/${slug}. It may have been removed or the URL is incorrect.`
      : "No report exists at the requested URL. It may have been removed or the URL is incorrect.";

  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Report not found</h2>
      <p style={bodyStyle}>{bodyText}</p>
    </section>
  );
}

export default NotFoundView;

// ---------------------------------------------------------------------------
// Inline styles, token-driven so the view inherits the Portal palette and
// reduced-motion defaults from `styles/tokens.css`.
// ---------------------------------------------------------------------------

const sectionStyle: CSSProperties = {
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--font-size-heading)",
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
};
