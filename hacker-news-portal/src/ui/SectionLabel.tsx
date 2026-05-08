import type { ReactElement, ReactNode } from "react";

import "./SectionLabel.css";

// ---------------------------------------------------------------------------
// SectionLabel primitive.
//
// Small-caps label used as an eyebrow above section headings. Semantically
// it is a <span>, because the accompanying <h2>/<h3> already owns the
// landmark role; the label itself is decorative hierarchy.
// ---------------------------------------------------------------------------

export interface SectionLabelProps {
  readonly as?: "span" | "div" | "p" | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function SectionLabel({
  as: Tag = "span",
  className,
  children,
}: SectionLabelProps): ReactElement {
  const composedClassName = ["ui-section-label", className]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return <Tag className={composedClassName}>{children}</Tag>;
}

export default SectionLabel;
