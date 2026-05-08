import type { ReportMetadata, GenerationStage, BackendError } from "./types";
import {
  ReportMetadataSchema,
  dataSourceUnavailable,
  generationInProgress,
  generationFailed,
} from "./types";

// ---------------------------------------------------------------------------
// Browser-side HTTP client for the Vite generation middleware.
//
// Speaks only to `/__api/generate` and translates HTTP status codes to the
// four `BackendErrorCode` values defined by `wireBackend/types.ts`. The UI
// therefore handles generation failures uniformly regardless of whether
// they originate from the runner, the middleware, or a production build
// where the middleware is absent (the latter surfaces as 503 →
// DATA_SOURCE_UNAVAILABLE per the design contract).
// ---------------------------------------------------------------------------

/** Shape of a successful `POST /__api/generate` response body. */
interface ResponseBody {
  readonly metadata: ReportMetadata;
  readonly runId?: string;
}

/** Shape of a non-2xx error body as produced by the middleware (Req 7.1). */
interface ErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly stage?: GenerationStage;
    readonly message?: string;
  };
}

const GENERATION_STAGES: ReadonlyArray<GenerationStage> = [
  "sentiment",
  "title",
  "titleValidation",
  "slugResolution",
  "persist",
  "reindex",
];

function isGenerationStage(value: unknown): value is GenerationStage {
  return (
    typeof value === "string" &&
    (GENERATION_STAGES as ReadonlyArray<string>).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Cache-bust token.
//
// After a successful `startGeneration`, the caller must force
// `staticBackend.listReports()` to refetch `/reports/index.json` so the new
// entry appears before navigation (Req 5.4, 9.3). The client owns the
// source of truth for the token; `staticBackend.ts` reads it via the
// exported accessor and appends it as a query string.
// ---------------------------------------------------------------------------

let generationCacheToken = "0";

/** Returns the current cache-bust token for `/reports/index.json`. */
export function getGenerationCacheToken(): string {
  return generationCacheToken;
}

/** Advances the cache-bust token; called after every successful generation. */
export function bumpGenerationCacheToken(token: string): void {
  generationCacheToken = token;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

/**
 * POSTs to `/__api/generate` and returns the parsed `ReportMetadata` for the
 * newly generated Report.
 *
 * Status mapping (Req 5.4, 5.6, 6.1, 6.3, 7.1, 7.3, 9.3, 12.4, 12.8):
 *   - 200            → resolve with validated `metadata`
 *   - 409            → reject `generationInProgress()`
 *   - 503            → reject `dataSourceUnavailable(cause)`
 *   - other non-2xx  → reject `generationFailed(stage ?? "sentiment", cause)`
 *   - network error  → reject `dataSourceUnavailable(cause)`
 *
 * Every non-2xx path resolves to exactly one of the four `BackendErrorCode`
 * values; no error is ever swallowed.
 */
export async function startGeneration(): Promise<ReportMetadata> {
  let response: Response;
  try {
    response = await fetch("/__api/generate", { method: "POST" });
  } catch (networkError) {
    throw dataSourceUnavailable(networkError);
  }

  if (response.status === 200) {
    return handleSuccess(response);
  }

  if (response.status === 409) {
    throw generationInProgress();
  }

  if (response.status === 503) {
    const cause = await buildErrorCause(
      response,
      "Generation endpoint unavailable.",
    );
    throw dataSourceUnavailable(cause);
  }

  // Any other non-2xx is treated as a structured generation failure.
  throw await buildGenerationFailed(response);
}

async function handleSuccess(response: Response): Promise<ReportMetadata> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (parseError) {
    throw dataSourceUnavailable(parseError);
  }

  if (typeof raw !== "object" || raw === null || !("metadata" in raw)) {
    throw dataSourceUnavailable(
      new Error(
        "POST /__api/generate returned a body without a `metadata` field.",
      ),
    );
  }

  const body = raw as Partial<ResponseBody>;
  const parsed = ReportMetadataSchema.safeParse(body.metadata);
  if (!parsed.success) {
    throw dataSourceUnavailable(parsed.error);
  }

  const token =
    typeof body.runId === "string" && body.runId.length > 0
      ? body.runId
      : Date.now().toString();
  bumpGenerationCacheToken(token);

  return parsed.data;
}

async function buildGenerationFailed(
  response: Response,
): Promise<BackendError> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    // Body was missing or not JSON; fall back to a generic cause.
    return generationFailed(
      "sentiment",
      new Error(
        `Generation failed with HTTP ${response.status.toString()} ${response.statusText}.`,
      ),
    );
  }

  const stage = extractStage(raw);
  const message = extractMessage(raw);
  const cause = new Error(
    message ??
      `Generation failed with HTTP ${response.status.toString()} ${response.statusText}.`,
  );
  return generationFailed(stage ?? "sentiment", cause);
}

async function buildErrorCause(
  response: Response,
  fallbackMessage: string,
): Promise<Error> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return new Error(fallbackMessage);
  }
  const message = extractMessage(raw) ?? fallbackMessage;
  return new Error(message);
}

function extractStage(raw: unknown): GenerationStage | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const body = raw as ErrorBody;
  if (body.error === undefined) {
    return undefined;
  }
  return isGenerationStage(body.error.stage) ? body.error.stage : undefined;
}

function extractMessage(raw: unknown): string | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const body = raw as ErrorBody;
  if (body.error === undefined) {
    return undefined;
  }
  const message = body.error.message;
  return typeof message === "string" && message.length > 0
    ? message
    : undefined;
}
