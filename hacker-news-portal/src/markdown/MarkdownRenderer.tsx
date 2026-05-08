import { lazy, Suspense } from "react";
import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Public Markdown renderer.
//
// This module is the public entry point. The actual ReactMarkdown + plugin
// stack lives in `MarkdownRenderer.impl.tsx` and is pulled in as a separate
// chunk via `React.lazy`, so the landing route never ships the heavy
// Markdown/syntax-highlight code until a report body is actually rendered
// (supports Req 15.1).
//
// Consumers use it exactly like a regular component:
//
//     <MarkdownRenderer>{body}</MarkdownRenderer>
//
// The wrapper owns the `<Suspense>` fallback so callers do not each have to
// remember to provide one; the fallback renders a lightweight placeholder
// while the impl chunk is downloading.
// ---------------------------------------------------------------------------

const LazyInner = lazy(() => import("./MarkdownRenderer.impl"));

export interface MarkdownRendererProps {
  readonly children: string;
}

/**
 * Lazy-loaded, sanitized Markdown renderer.
 *
 * `children` is the report body with YAML front-matter already stripped by
 * the caller (`staticBackend.getReport`). The renderer itself never strips
 * front-matter.
 */
export function MarkdownRenderer({
  children,
}: MarkdownRendererProps): ReactElement {
  return (
    <Suspense fallback={<p>Loading report…</p>}>
      <LazyInner>{children}</LazyInner>
    </Suspense>
  );
}

export default MarkdownRenderer;
