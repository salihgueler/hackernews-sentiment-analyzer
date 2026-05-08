import rehypeHighlight from "rehype-highlight";

/**
 * `rehype-highlight` plugin tuple for the portal's Markdown renderer.
 *
 * Configuration:
 * - `ignoreMissing: true` — code fences whose language identifier is not a
 *   registered `highlight.js` grammar fall back to plain monospaced text
 *   rather than throwing (Requirement 10.4).
 * - `plainText: []` — no languages are force-skipped, so every recognized
 *   language produces highlighted output (Requirement 10.3).
 *
 * Exported as a `readonly` tuple so `MarkdownRenderer` can place it directly
 * inside react-markdown's `rehypePlugins` prop (the prop's `PluggableList`
 * accepts `[plugin, options]` tuples).
 */
export const highlightPlugin = [
  rehypeHighlight,
  { ignoreMissing: true, plainText: [] as string[] },
] as const;
