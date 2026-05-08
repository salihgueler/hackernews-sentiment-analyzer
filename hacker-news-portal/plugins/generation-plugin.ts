// Node-only module. Registered as a Vite plugin; never bundled into the
// browser build. Owns the singleton HTTP surface the Portal uses to kick
// off a Generation Run.
/**
 * Vite Generation Plugin — registers the `/__api/generate` middleware on
 * both the dev server and the `vite preview` server so the Portal's
 * browser-side `wireBackend` client (see `src/wireBackend/generationClient.ts`)
 * can drive the Generation Run singleton living in this Node process.
 *
 * Realizes:
 *  - Requirement 6.1  (shared runner across every /__api/generate request)
 *  - Requirement 6.2  (preserve the in-flight run; never start a second)
 *  - Requirement 7.1  (structured failure response with code + stage + msg)
 *  - Requirement 12.4 (200 on success resolves with ReportMetadata)
 *  - Requirement 12.8 (409 on concurrent start)
 *
 * Design cross-references:
 *  - Components §2 Vite Generation Plugin
 *  - Components §7 wireBackend Static Implementation (status mapping)
 *  - Error Handling table
 *
 * Production-deployment note (Req 12.7):
 *   This plugin is registered by `vite.config.ts` for dev and preview only.
 *   Production static hosts never load it, so a browser that POSTs to
 *   `/__api/generate` there will get the host's default behavior (404/403).
 *   The browser `generationClient` already maps non-2xx to
 *   `DATA_SOURCE_UNAVAILABLE` or `GENERATION_FAILED` uniformly, so no
 *   additional code is needed in the Portal bundle. A production deployment
 *   that wants to return a precise `503 DATA_SOURCE_UNAVAILABLE` must
 *   configure its host to do so at deploy time; this is a deploy-time
 *   concern, not a build-time one.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

import {
  getGenerationRunner,
  getGenerationState,
  type GenerationRunner,
} from "../src/generation/GenerationRunner";
import { BackendError, type ReportMetadata } from "../src/wireBackend/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed URL prefix the middleware is mounted at. */
const GENERATION_ENDPOINT = "/__api/generate";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/** Connect-style `next` callback. Kept three-arg for compatibility. */
type NextFn = (err?: unknown) => void;

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { error: { code: "NOT_FOUND" } });
}

function sendMethodNotAllowed(res: ServerResponse): void {
  sendJson(res, 405, { error: { code: "METHOD_NOT_ALLOWED" } });
}

function sendGenerationInProgress(res: ServerResponse): void {
  sendJson(res, 409, { error: { code: "GENERATION_IN_PROGRESS" } });
}

/**
 * Translate any generation-time error into the 500 + structured body the
 * browser client expects. Preserves `stage` when the error is a
 * `BackendError` of code `GENERATION_FAILED` (the only code the runner
 * emits from async rejections); falls back to a stage-less payload for
 * any other (defensive) thrown value.
 */
function sendGenerationFailed(res: ServerResponse, err: unknown): void {
  if (err instanceof BackendError && err.code === "GENERATION_FAILED") {
    sendJson(res, 500, {
      error: {
        code: "GENERATION_FAILED",
        stage: err.stage,
        message: err.message,
      },
    });
    return;
  }
  const message =
    err instanceof Error && err.message.length > 0
      ? err.message
      : "Generation failed.";
  sendJson(res, 500, {
    error: { code: "GENERATION_FAILED", message },
  });
}

// ---------------------------------------------------------------------------
// Request dispatch
// ---------------------------------------------------------------------------

/**
 * `use(path, mw)` in Connect strips the matching prefix from `req.url`.
 * After stripping, the exact endpoint maps to `"/"`; any subpath
 * (e.g. `/__api/generate/extra`) maps to `"/extra"` and MUST 404 so
 * typos and probes do not silently match.
 */
function matchesExactRoot(req: IncomingMessage): boolean {
  const url = req.url ?? "/";
  const queryIndex = url.indexOf("?");
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
  return pathname === "/" || pathname === "";
}

async function handlePost(
  runner: GenerationRunner,
  res: ServerResponse,
): Promise<void> {
  // `runner.start()` throws synchronously when a prior run is still
  // `"running"`, so the sync branch MUST be caught before we await.
  let pending: Promise<ReportMetadata>;
  try {
    pending = runner.start();
  } catch (syncErr) {
    if (
      syncErr instanceof BackendError &&
      syncErr.code === "GENERATION_IN_PROGRESS"
    ) {
      sendGenerationInProgress(res);
      return;
    }
    sendGenerationFailed(res, syncErr);
    return;
  }

  try {
    const metadata = await pending;
    // `runId` is captured from `metadata.id` because the runner sets
    // `metadata.id = runId` at pipeline start. Reading `runner.runId`
    // would be racy once a concurrent caller transitions the singleton
    // past "completed" into a new run.
    sendJson(res, 200, { metadata, runId: metadata.id });
  } catch (err) {
    if (err instanceof BackendError && err.code === "GENERATION_IN_PROGRESS") {
      // Defensive: the runner only throws GENERATION_IN_PROGRESS
      // synchronously today, but map the async path too so the client
      // contract is future-proof.
      sendGenerationInProgress(res);
      return;
    }
    sendGenerationFailed(res, err);
  }
}

function handleGet(res: ServerResponse): void {
  sendJson(res, 200, { status: getGenerationState() });
}

/**
 * Connect middleware installed at `GENERATION_ENDPOINT`. Shared by the
 * dev server and the preview server so production-like smoke runs drive
 * the exact same code path.
 */
function createMiddleware(runner: GenerationRunner) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    _next: NextFn,
  ): Promise<void> => {
    if (!matchesExactRoot(req)) {
      sendNotFound(res);
      return;
    }

    const method = req.method ?? "GET";
    if (method === "POST") {
      await handlePost(runner, res);
      return;
    }
    if (method === "GET") {
      handleGet(res);
      return;
    }
    sendMethodNotAllowed(res);
  };
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

/**
 * Build the Vite plugin. Captures the module-scoped `GenerationRunner`
 * singleton in the plugin closure so every request in the Node process
 * observes the same state machine (Req 6.1).
 */
export default function generationPlugin(): Plugin {
  // `getGenerationRunner()` is backed by a module-scoped singleton in
  // `src/generation/GenerationRunner.ts`, so calling it here once yields
  // the same instance every subsequent caller would see. Capturing it in
  // closure also guarantees the middleware never re-resolves the module
  // import on the hot path.
  const runner = getGenerationRunner();
  const middleware = createMiddleware(runner);

  return {
    name: "hacker-news-portal:generation",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(GENERATION_ENDPOINT, middleware);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(GENERATION_ENDPOINT, middleware);
    },
  };
}
