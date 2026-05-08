import type { BackendInterface } from "./types";
import { getReport, listReports } from "./staticBackend";
import { startGeneration } from "./generationClient";

// ---------------------------------------------------------------------------
// Single public entry point for the `wireBackend` module.
//
// UI code (Sidebar, ReportView, GenerateReportButton, …) imports from this
// barrel rather than reaching into the implementation files. The barrel
// enforces the module-dependency rule established in the design: the UI
// depends on `wireBackend` only, and any future backend swap is performed
// behind this boundary without touching UI code (Req 12.1, 12.5).
//
// Under `verbatimModuleSyntax`, type-only re-exports must use `export type`
// and runtime values must use plain `export`. The two groups below
// follow that split.
// ---------------------------------------------------------------------------

// Types (erased at emit time).
export type {
  BackendErrorCode,
  BackendErrorInit,
  BackendInterface,
  GenerationStage,
  GenerationState,
  GenerationStateBase,
  ReportMetadata,
  ReportPayload,
} from "./types";

// Runtime values from `./types`.
export {
  BackendError,
  ReportMetadataSchema,
  dataSourceUnavailable,
  generationFailed,
  generationInProgress,
  notFound,
} from "./types";

// Runtime values from `./staticBackend`.
export {
  getReport,
  getReportBody,
  invalidateStaticCaches,
  listReports,
} from "./staticBackend";

// Runtime values from `./generationClient`.
export {
  bumpGenerationCacheToken,
  getGenerationCacheToken,
  startGeneration,
} from "./generationClient";

/**
 * Returns the default `BackendInterface` implementation wired up from the
 * static-asset backend and the generation HTTP client.
 *
 * This is the single factory UI code should use to obtain a backend: it
 * binds `listReports` / `getReport` (static reads) to `startGeneration`
 * (HTTP client) without leaking the concrete modules to the caller. A
 * future production backend only has to replace this factory — every
 * call site keeps working as long as the returned object satisfies
 * `BackendInterface`.
 */
export function createWireBackend(): BackendInterface {
  return {
    listReports,
    getReport,
    startGeneration,
  };
}
