import { z } from "zod";

// ---------------------------------------------------------------------------
// Public value/shape types for the wireBackend module.
//
// These types define the contract a future production backend must satisfy.
// The UI depends ONLY on this module for Report metadata shapes and error
// handling (Req 12.5). Any new backend implementation (static HTTP today,
// server-backed tomorrow) must be satisfy `BackendInterface`.
// ---------------------------------------------------------------------------

/**
 * Metadata for a single Report extracted from its YAML front-matter.
 * Field semantics match `ReportFrontMatterSchema` in `domain/frontMatter.ts`.
 */
export interface ReportMetadata {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly generatedAt: string;
  readonly prompt: string;
}

/**
 * A fully materialized Report: metadata plus the Markdown body.
 * `body` has its leading front-matter block stripped by the backend before
 * being returned to the UI.
 */
export interface ReportPayload {
  readonly metadata: ReportMetadata;
  readonly body: string;
}

/**
 * Closed set of machine-readable error codes the backend may surface.
 * Every rejection from a `BackendInterface` method is one of these codes.
 */
export type BackendErrorCode =
  | "NOT_FOUND"
  | "DATA_SOURCE_UNAVAILABLE"
  | "GENERATION_IN_PROGRESS"
  | "GENERATION_FAILED";

/**
 * The ordered stages of a Generation Run. The `stage` on a
 * `GENERATION_FAILED` error identifies where in the pipeline the failure
 * occurred; the same tag drives the on-disk/JSON audit record.
 */
export type GenerationStage =
  | "sentiment"
  | "title"
  | "titleValidation"
  | "slugResolution"
  | "persist"
  | "reindex";

/**
 * Public backend interface consumed by the Portal UI. Any implementation
 * (static HTTP reads, future production backend) must satisfy exactly this
 * shape.
 */
export interface BackendInterface {
  listReports(): Promise<ReadonlyArray<ReportMetadata>>;
  getReport(slug: string): Promise<ReportPayload>;
  startGeneration(): Promise<ReportMetadata>;
}

/**
 * Fields shared by every non-idle `GenerationState` variant.
 */
export interface GenerationStateBase {
  readonly runId: string;
  readonly startedAt: string;
}

/**
 * Discriminated union describing the full lifecycle of a Generation Run
 * from the caller's perspective. Drives `GET /__api/generate` and the
 * Portal progress banner.
 */
export type GenerationState =
  | { readonly status: "idle" }
  | ({
      readonly status: "running";
      readonly stage: GenerationStage;
    } & GenerationStateBase)
  | ({
      readonly status: "completed";
      readonly metadata: ReportMetadata;
    } & GenerationStateBase)
  | ({
      readonly status: "failed";
      readonly stage: GenerationStage;
      readonly message: string;
    } & GenerationStateBase);

// ---------------------------------------------------------------------------
// Zod schema for runtime validation of `index.json` payloads.
//
// Kept inline here (rather than imported from `domain/frontMatter.ts`) so the
// UI never depends on the domain-layer helpers purely for shape validation.
// The shape and regexes match `ReportFrontMatterSchema` byte-for-byte.
// ---------------------------------------------------------------------------

export const ReportMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  generatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/),
  prompt: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Error type.
//
// `BackendError` is a runtime `Error` subclass so callers can use
// `instanceof BackendError` and then narrow on `code` for typed recovery.
// The standard `Error` `cause` option is threaded through so underlying
// failures remain inspectable via `error.cause`.
// ---------------------------------------------------------------------------

export interface BackendErrorInit {
  readonly code: BackendErrorCode;
  readonly message: string;
  readonly stage?: GenerationStage;
  readonly cause?: unknown;
}

export class BackendError extends Error {
  readonly code: BackendErrorCode;
  readonly stage?: GenerationStage;

  constructor(init: BackendErrorInit) {
    super(
      init.message,
      init.cause !== undefined ? { cause: init.cause } : undefined,
    );
    this.name = "BackendError";
    this.code = init.code;
    if (init.stage !== undefined) {
      this.stage = init.stage;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory functions. Each factory is the single supported way to construct
// a `BackendError` of the corresponding code, so messages stay consistent
// across the codebase and call sites do not have to remember the exact
// string conventions.
// ---------------------------------------------------------------------------

/** No report is registered under the requested slug. */
export function notFound(slug: string): BackendError {
  return new BackendError({
    code: "NOT_FOUND",
    message: `Report not found for slug "${slug}".`,
  });
}

/**
 * The underlying data source (static asset, backend service, network) is
 * unavailable or returned malformed data. The triggering error, if any, is
 * preserved via `cause` for diagnostics.
 */
export function dataSourceUnavailable(cause?: unknown): BackendError {
  return new BackendError({
    code: "DATA_SOURCE_UNAVAILABLE",
    message: "Report data source is unavailable.",
    cause,
  });
}

/** A Generation Run is already in progress; the new request was refused. */
export function generationInProgress(): BackendError {
  return new BackendError({
    code: "GENERATION_IN_PROGRESS",
    message: "A generation run is already in progress.",
  });
}

/**
 * A Generation Run failed at `stage`. The triggering error, if any, is
 * preserved via `cause` for diagnostics and for the structured failure log
 * written by the runner.
 */
export function generationFailed(
  stage: GenerationStage,
  cause?: unknown,
): BackendError {
  return new BackendError({
    code: "GENERATION_FAILED",
    message: `Generation failed during stage "${stage}".`,
    stage,
    cause,
  });
}
