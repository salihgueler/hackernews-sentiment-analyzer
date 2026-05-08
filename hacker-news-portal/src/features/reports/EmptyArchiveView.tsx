import type { CSSProperties, ReactElement } from "react";

// ---------------------------------------------------------------------------
// EmptyArchiveView — main-view surface for the "Report_Index is empty"
// branch on the root route (Req 1.4). The Sidebar renders its own
// matching placeholder via `Sidebar`, so this component is only
// responsible for the main-view message.
//
// The copy instructs the Visitor to use the header `Generate Report`
// button so the landing experience is self-documenting when there is no
// content to render.
// ---------------------------------------------------------------------------

export function EmptyArchiveView(): ReactElement {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>No reports available yet</h2>
      <p style={bodyStyle}>
        Click &quot;Generate Report&quot; above to create your first sentiment
        analysis.
      </p>
    </section>
  );
}

export default EmptyArchiveView;

// ---------------------------------------------------------------------------
// Inline styles.
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
