import type { ReactElement, ReactNode } from "react";

import "./Chip.css";

// ---------------------------------------------------------------------------
// Chip primitive.
//
// Small mono-font tag used for sentiment labels and compact metadata like
// dates. The `tone` prop maps directly onto the `--color-sentiment-*`
// tokens declared in tokens.css; the default "neutral" tone is also the
// intended surface for non-sentiment uses such as a date chip.
// ---------------------------------------------------------------------------

export type ChipTone = "positive" | "negative" | "mixed" | "neutral";

export interface ChipProps {
  readonly tone?: ChipTone | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Chip({
  tone = "neutral",
  className,
  children,
}: ChipProps): ReactElement {
  const composedClassName = ["ui-chip", `ui-chip--${tone}`, className]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return <span className={composedClassName}>{children}</span>;
}

export default Chip;
