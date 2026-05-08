import { Component } from "react";
import type { ErrorInfo, ReactElement, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { sanitizeSchema } from "./sanitizeSchema";
import { highlightPlugin } from "./highlight";

// ---------------------------------------------------------------------------
// MarkdownRenderer implementation.
//
// This module is the actual bundle that `MarkdownRenderer.tsx` loads via
// `React.lazy`, so the heavy Markdown + syntax-highlight stack stays off the
// landing critical path (supports Req 15.1). Kept as a default export because
// `React.lazy` requires a module that default-exports a component.
//
// Pipeline (Req 10.1–10.4):
//
//   <ReactMarkdown
//     remarkPlugins={[remarkGfm]}
//     rehypePlugins={[[rehypeSanitize, sanitizeSchema], highlightPlugin]}
//   />
//
// - `remark-gfm` enables GitHub-flavored Markdown tables, task lists, etc.
// - `rehype-sanitize` with our hardened `sanitizeSchema` runs first so every
//   downstream plugin sees a sanitized tree (Req 10.2). We never pass
//   `rehype-raw`, so raw HTML in the Markdown source is escaped rather than
//   injected into the DOM.
// - `highlightPlugin` is the pre-configured `rehype-highlight` tuple with
//   `{ ignoreMissing: true, plainText: [] }` (Req 10.3, 10.4).
//
// ErrorBoundary (Req 1.3, React-side safety net):
//
// A render-time throw anywhere under `<ReactMarkdown>` (e.g. an upstream plugin
// emitting a malformed tree) is caught, logged via `console.error`, and
// replaced with a fallback that surfaces the original report body inside a
// `<pre>` so the user can still read it. A visible `role="alert"` banner
// communicates the degradation to assistive tech.
//
// The boundary accepts the raw Markdown body as its `children` prop (a
// `string`) so the fallback has the exact source to render, and the non-error
// branch forwards that same string to `<ReactMarkdown>`. This mirrors the
// design's "raw-text fallback with a visible banner" contract exactly.
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  readonly children: string;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: unknown): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    // Report the caught error so it surfaces in dev-tools / test logs even
    // though the UI has already degraded to the fallback.
    // eslint-disable-next-line no-console
    console.error(error);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <>
          <div role="alert">Could not render this report.</div>
          <pre>{this.props.children}</pre>
        </>
      );
    }
    // `highlightPlugin` is exported `as const` (a readonly tuple), which
    // is not assignable to unified's mutable `PluginTuple` shape. Rebuild
    // a fresh mutable tuple by indexed access so the `rehypePlugins` prop
    // type-checks without widening to `unknown[]`.
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSanitize, sanitizeSchema],
          [highlightPlugin[0], highlightPlugin[1]],
        ]}
      >
        {this.props.children}
      </ReactMarkdown>
    );
  }
}

interface MarkdownRendererImplProps {
  readonly children: string;
}

function MarkdownRendererImpl({
  children,
}: MarkdownRendererImplProps): ReactElement {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default MarkdownRendererImpl;
