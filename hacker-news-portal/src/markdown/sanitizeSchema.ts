import { defaultSchema, type Schema } from "hast-util-sanitize";

/**
 * Sanitization schema for the portal's Markdown renderer.
 *
 * Starts from `hast-util-sanitize`'s `defaultSchema` (GitHub-style) and
 * tightens it in three ways to realize Requirement 10.2:
 *
 *  1. The tag names `script`, `style`, `iframe`, `object`, `embed`, `link`,
 *     `meta`, and `form` are removed from `tagNames`, so they are never
 *     emitted even if produced by upstream plugins.
 *  2. Every attribute whose name begins with `on` is dropped from every
 *     tag's attribute list, including the wildcard `*` bucket. This covers
 *     the full family of inline event handlers (`onclick`, `onerror`, ...).
 *  3. `className` is allowed on `code` and `pre` so the language classes
 *     emitted by `rehype-highlight` survive sanitization (Req 10.3, 10.4).
 *
 * The deny list is enforced schema-wide: a new event-handler-style attribute
 * added by an upstream plugin (for any tag, or the `*` wildcard) would be
 * filtered out automatically on the next render.
 */

// Tags that must never appear in the rendered DOM (Req 10.2).
const FORBIDDEN_TAGS: ReadonlySet<string> = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "form",
]);

/**
 * A single entry in a `Schema["attributes"][tag]` array: either the bare
 * attribute name or a tuple `[name, ...allowedValues]`.
 */
type AttributeEntry = NonNullable<Schema["attributes"]>[string][number];

/** Extract the attribute name from an {@link AttributeEntry}. */
function attributeName(entry: AttributeEntry): string {
  return typeof entry === "string" ? entry : entry[0];
}

/** `true` when the entry's attribute name begins with the `on` prefix. */
function isEventHandlerAttribute(entry: AttributeEntry): boolean {
  return attributeName(entry).startsWith("on");
}

function buildSanitizeSchema(): Schema {
  // Deep-clone so mutations here never leak back to `defaultSchema`.
  // `structuredClone` preserves `RegExp` values (e.g. `code`'s
  // `/^language-./` className matcher), which a JSON round-trip would lose.
  const schema: Schema = structuredClone(defaultSchema);

  if (schema.tagNames !== undefined && schema.tagNames !== null) {
    schema.tagNames = schema.tagNames.filter((tag) => !FORBIDDEN_TAGS.has(tag));
  }

  // Drop every `on*` attribute from every tag, including the `*` wildcard.
  const attributes: NonNullable<Schema["attributes"]> = {};
  if (schema.attributes !== undefined && schema.attributes !== null) {
    for (const [tag, entries] of Object.entries(schema.attributes)) {
      attributes[tag] = entries.filter(
        (entry) => !isEventHandlerAttribute(entry),
      );
    }
  }

  // Ensure `className` is allowed on `code` and `pre` so highlight classes
  // survive sanitization. Only append when no existing entry names it.
  for (const tag of ["code", "pre"] as const) {
    const existing = attributes[tag] ?? [];
    const hasClassName = existing.some(
      (entry) => attributeName(entry) === "className",
    );
    if (!hasClassName) {
      const classNameEntry: AttributeEntry = ["className"];
      attributes[tag] = [...existing, classNameEntry];
    }
  }

  schema.attributes = attributes;
  return schema;
}

export const sanitizeSchema: Schema = buildSanitizeSchema();
