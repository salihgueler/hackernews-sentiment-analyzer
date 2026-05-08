import type { CSSProperties, ReactElement } from "react";

import "./Skeleton.css";

// ---------------------------------------------------------------------------
// Skeleton primitive.
//
// Renders a block-level placeholder with a subtle shimmer. Two variants
// cover the common cases:
//   - "line"  — a single line of body text. Width is configurable via
//               the optional `width` prop and defaults to 100%.
//   - "block" — a rectangular region (card, image, etc.).
//
// The `aria-hidden="true"` attribute keeps the skeleton out of the
// assistive tree; copy intended for screen readers belongs in the
// surrounding loading message, not on the visual placeholder.
//
// Shimmer is driven by the `ui-skeleton-shimmer` keyframe declared in
// Skeleton.css. Under `prefers-reduced-motion: reduce` the global
// animation-duration reset in tokens.css collapses the animation to a
// single non-animated frame, so the token stays a static rectangle
// without needing a per-component media query.
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  readonly variant?: "line" | "block" | undefined;
  readonly width?: string | number | undefined;
  readonly height?: string | number | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}

function resolveSize(value: string | number | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "number" ? `${value.toString()}px` : value;
}

export function Skeleton({
  variant = "line",
  width,
  height,
  className,
  style,
}: SkeletonProps): ReactElement {
  const resolvedWidth = resolveSize(width);
  const resolvedHeight = resolveSize(height);
  const mergedStyle: CSSProperties = {
    ...(resolvedWidth !== undefined ? { width: resolvedWidth } : {}),
    ...(resolvedHeight !== undefined ? { height: resolvedHeight } : {}),
    ...style,
  };
  const composedClassName = [
    "ui-skeleton",
    `ui-skeleton--${variant}`,
    className,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return (
    <span
      aria-hidden="true"
      className={composedClassName}
      style={mergedStyle}
    />
  );
}

export default Skeleton;
