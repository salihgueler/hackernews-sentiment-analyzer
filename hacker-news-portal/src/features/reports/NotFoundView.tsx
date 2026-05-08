import { useCallback } from "react";
import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../ui/Button";
import { SectionLabel } from "../../ui/SectionLabel";

import "./EmptyState.css";

// ---------------------------------------------------------------------------
// NotFoundView — main-view surface for the "slug not in Report_Index"
// branch (Req 3.4) and the catch-all `*` route. The Sidebar is always
// rendered alongside because it is a sibling of the main view in
// `Layout`; this component's only responsibility is the main-view
// message (Req 3.4 last clause).
//
// When rendered under `/reports/:slug` for an unknown slug, `slug` is
// threaded through from `ReportView` so the message can echo the URL
// the Visitor tried. When rendered under the catch-all route, `slug`
// is omitted and the message degrades gracefully. A single primary
// action ("Back to latest") navigates to `/`, the landing route.
// ---------------------------------------------------------------------------

export interface NotFoundViewProps {
  readonly slug?: string;
}

const NOT_FOUND_ILLUSTRATION: ReactElement = (
  <svg
    aria-hidden="true"
    viewBox="0 0 96 96"
    xmlns="http://www.w3.org/2000/svg"
    className="empty-state__illustration"
  >
    <circle cx="48" cy="48" r="42" fill="var(--color-accent-soft)" />
    <path
      d="M30 60c0-10 8-18 18-18s18 8 18 18"
      stroke="currentColor"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="40" cy="42" r="3" fill="currentColor" />
    <circle cx="56" cy="42" r="3" fill="currentColor" />
  </svg>
);

export function NotFoundView({ slug }: NotFoundViewProps): ReactElement {
  const navigate = useNavigate();
  const handleBack = useCallback((): void => {
    navigate("/");
  }, [navigate]);

  const bodyText =
    slug !== undefined && slug.length > 0
      ? `No report exists at /reports/${slug}. It may have been removed or the URL is incorrect.`
      : "No report exists at the requested URL. It may have been removed or the URL is incorrect.";

  return (
    <section className="empty-state">
      {NOT_FOUND_ILLUSTRATION}
      <SectionLabel>Not found</SectionLabel>
      <h2 className="empty-state__title">Report not found</h2>
      <p className="empty-state__body">{bodyText}</p>
      <div className="empty-state__actions">
        <Button variant="primary" onClick={handleBack}>
          Back to latest
        </Button>
      </div>
    </section>
  );
}

export default NotFoundView;
