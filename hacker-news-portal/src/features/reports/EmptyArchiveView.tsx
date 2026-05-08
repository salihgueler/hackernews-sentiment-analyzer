import type { ReactElement } from "react";
import { Sparkles } from "lucide-react";

import { SectionLabel } from "../../ui/SectionLabel";

import "./EmptyState.css";

// ---------------------------------------------------------------------------
// EmptyArchiveView — main-view surface for the "Report_Index is empty"
// branch on the root route (Req 1.4). The Sidebar renders its own
// matching placeholder via `Sidebar`, so this component is only
// responsible for the main-view message.
//
// The illustration is a hoisted inline <svg> (per rendering-hoist-jsx)
// and the primary action points to the header `Generate Report` button
// — not rendered here, but the copy instructs the Visitor to find it
// at the top of the shell.
// ---------------------------------------------------------------------------

const EMPTY_ILLUSTRATION: ReactElement = (
  <svg
    aria-hidden="true"
    viewBox="0 0 96 96"
    xmlns="http://www.w3.org/2000/svg"
    className="empty-state__illustration"
  >
    <circle cx="48" cy="48" r="42" fill="var(--color-accent-soft)" />
    <path
      d="M32 44h32M32 54h24M32 34h32"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

export function EmptyArchiveView(): ReactElement {
  return (
    <section className="empty-state">
      {EMPTY_ILLUSTRATION}
      <SectionLabel>Archive</SectionLabel>
      <h2 className="empty-state__title">No reports yet</h2>
      <p className="empty-state__body">
        Use the{" "}
        <span aria-hidden="true">
          <Sparkles size={14} />
        </span>{" "}
        <strong>Generate Report</strong> button at the top of the page to create
        your first sentiment analysis.
      </p>
    </section>
  );
}

export default EmptyArchiveView;
