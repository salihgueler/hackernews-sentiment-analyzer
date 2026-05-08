// Node-only module. Must not be imported by browser code (Req 14.3).
/**
 * Generation Runner — the singleton state machine that drives a full
 * Hacker News sentiment-report Generation Run through the six-stage
 * pipeline `sentiment → title → titleValidation → slugResolution →
 * persist → reindex`.
 *
 * Realizes:
 *  - Requirement 5.4  (startGeneration resolves with new metadata)
 *  - Requirement 6.1  (reject concurrent generate requests)
 *  - Requirement 6.2  (preserve the in-flight run on concurrent rejection)
 *  - Requirement 7.1  (structured failure record with runId, stage, cause)
 *  - Requirement 7.2  (no partial writes on failure; index stays byte-identical)
 *  - Requirement 8.6  (persist stage cleans up partial files on failure)
 *  - Requirement 11.5 (Zod-invalid title output ⇒ titleValidation failure)
 *  - Requirement 11.6 (slug collision appends smallest suffix in -2..-999)
 *  - Requirement 11.7 (all suffixes taken ⇒ slugResolution failure)
 *  - Requirement 12.4 (start-generation resolves with new ReportMetadata)
 *  - Requirement 12.8 (start-generation rejects with GENERATION_IN_PROGRESS)
 *  - Requirement 14.3 (read-only use of strands-agent-typescript)
 *
 * Design cross-references:
 *  - Components §3 (GenerationRunner state machine and pipeline stages)
 *  - Error Handling → internal (Node-side structured log)
 *  - Realizes Properties 8 (concurrency) and 9 (failure safety)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentResult, ContentBlock } from "@strands-agents/sdk";
import { z, ZodError } from "zod";

import { isValidSlug, resolveSlugCollision, type Slug } from "../domain/slug";
import type {
  GenerationStage,
  GenerationState,
  ReportMetadata,
} from "../wireBackend/types";
import {
  ReportMetadataSchema,
  generationFailed,
  generationInProgress,
} from "../wireBackend/types";
import { formatGeneratedAt, newReportId, persistReport } from "./persistReport";
import { TitleAgentOutputSchema, invokeTitleAgent } from "./titleAgent";
import { runPrebuildIndexer } from "../../scripts/prebuild-reports";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default prompt sent to the Sentiment Agent. Recorded verbatim in the
 * resulting Report's YAML front-matter so future readers can see exactly
 * what was asked.
 */
const SENTIMENT_PROMPT =
  "Analyze the top 5 Hacker News front page stories and produce a sentiment report.";

/**
 * Relative module specifier for the sibling Sentiment Agent. Resolved at
 * runtime by Node against the sibling's compiled output
 * (`strands-agent-typescript/dist/agent.js`). The specifier targets the
 * built JS, not the `.ts` source, because the Vite dev server executes
 * this module under plain Node ESM — `import()` cannot load TypeScript
 * directly. The operator must therefore run `npm run build` inside
 * `strands-agent-typescript/` before the `/__api/generate` endpoint can
 * succeed; the sentiment stage surfaces a clear failure message if the
 * build output is missing.
 *
 * The specifier is stored as a variable (rather than a literal `import`)
 * so TypeScript does not attempt to statically resolve it into the
 * sibling project at compile time — the sibling is not part of this
 * tsconfig's include list (Req 14.3, read-only).
 */
const SIBLING_SENTIMENT_AGENT_MODULE_PATH =
  "../../../strands-agent-typescript/dist/agent.js";

/** Absolute path of this source file, used for path resolution. */
const THIS_FILE = fileURLToPath(import.meta.url);

/**
 * Absolute path of `public/reports/index.json` (the prebuild-materialized
 * Report_Index). Resolved once at module load relative to this file:
 *
 *   hacker-news-portal/src/generation/GenerationRunner.ts   (this file)
 *   hacker-news-portal/public/reports/index.json            (target)
 */
const PUBLIC_REPORTS_INDEX_PATH = path.resolve(
  path.dirname(THIS_FILE),
  "../../public/reports/index.json",
);

// ---------------------------------------------------------------------------
// Shapes for the dynamically-imported sibling Sentiment Agent
// ---------------------------------------------------------------------------

/**
 * Minimal structural contract the dynamic sibling module must satisfy:
 * a `createHackerNewsSentimentAgent` factory returning something that
 * accepts a string prompt via `invoke` and resolves to an `AgentResult`.
 */
interface SentimentAgentLike {
  readonly invoke: (prompt: string) => Promise<AgentResult>;
}

interface SentimentAgentModule {
  readonly createHackerNewsSentimentAgent: () => SentimentAgentLike;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Node-style object with a `code: string` property, e.g. `ENOENT`. */
function hasErrorCode(value: unknown): value is { readonly code: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "string"
  );
}

/** Reduce any thrown value to a human-readable, non-empty string. */
function describeError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const pathLabel =
          issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${pathLabel}: ${issue.message}`;
      })
      .join("; ");
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

/**
 * Concatenate every `textBlock` in an `AgentResult`'s final message, in
 * order. Mirrors the pattern used by `titleAgent.ts` to turn a
 * possibly-multiblock response into a single string.
 */
function extractMarkdownFromAgentResult(result: AgentResult): string {
  const parts: string[] = [];
  const blocks: ReadonlyArray<ContentBlock> = result.lastMessage.content;
  for (const block of blocks) {
    if (block.type === "textBlock") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

/**
 * Read `public/reports/index.json`, validate it as
 * `ReportMetadata[]`, and return a `ReadonlySet` of every `slug` already
 * in use. Missing file → empty set (first-ever run before the Prebuild
 * Script has materialized an index).
 */
async function readExistingSlugs(): Promise<ReadonlySet<string>> {
  let text: string;
  try {
    text = await readFile(PUBLIC_REPORTS_INDEX_PATH, "utf8");
  } catch (cause) {
    if (hasErrorCode(cause) && cause.code === "ENOENT") {
      return new Set<string>();
    }
    throw cause;
  }
  const raw: unknown = JSON.parse(text);
  const metas = z.array(ReportMetadataSchema).parse(raw);
  return new Set<string>(metas.map((m) => m.slug));
}

/** Dynamically import the sibling Sentiment Agent module (see path const). */
async function loadSentimentAgentModule(): Promise<SentimentAgentModule> {
  let imported: SentimentAgentModule;
  try {
    imported = (await import(
      SIBLING_SENTIMENT_AGENT_MODULE_PATH
    )) as SentimentAgentModule;
  } catch (cause) {
    // Node raises `ERR_MODULE_NOT_FOUND` when the sibling has not been
    // built yet. Translate that into an operator-actionable message; any
    // other import-time failure re-throws as-is so its message reaches
    // the structured failure record unchanged.
    if (hasErrorCode(cause) && cause.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        "Sibling sentiment agent build output not found at " +
          "strands-agent-typescript/dist/agent.js. Run `npm run build` " +
          "inside strands-agent-typescript/ before invoking /__api/generate.",
      );
    }
    throw cause;
  }
  if (typeof imported.createHackerNewsSentimentAgent !== "function") {
    throw new Error(
      "Sibling sentiment agent module is missing the " +
        "`createHackerNewsSentimentAgent` export; cannot run sentiment stage.",
    );
  }
  return imported;
}

// ---------------------------------------------------------------------------
// Public runner state types
// ---------------------------------------------------------------------------

export type RunnerStatus = "idle" | "running" | "completed" | "failed";

export interface RunnerErrorRecord {
  readonly stage: GenerationStage;
  readonly message: string;
  readonly cause?: unknown;
}

// ---------------------------------------------------------------------------
// GenerationRunner
// ---------------------------------------------------------------------------

/**
 * Singleton state machine that serializes one Generation Run at a time
 * per Node process. All state transitions are synchronous; the mutex is
 * the `status === "running"` check at the top of `start()`.
 */
export class GenerationRunner {
  status: RunnerStatus = "idle";
  runId: string | null = null;
  startedAt: string | null = null;
  stage: GenerationStage | null = null;
  lastError: RunnerErrorRecord | null = null;
  busyPromise: Promise<ReportMetadata> | null = null;

  /**
   * Metadata of the most recently completed run, used to surface a
   * `"completed"` `GenerationState` to the optional polling endpoint.
   * `null` until the first successful run.
   */
  private lastMetadata: ReportMetadata | null = null;

  /**
   * Start a new Generation Run. Rejects synchronously (via `throw`) with
   * `generationInProgress()` if another run is already in progress, so a
   * caller observes the rejection even before awaiting.
   */
  start(): Promise<ReportMetadata> {
    if (this.status === "running") {
      throw generationInProgress();
    }

    const runId = newReportId();
    const startedAt = formatGeneratedAt(new Date());

    this.status = "running";
    this.runId = runId;
    this.startedAt = startedAt;
    this.stage = "sentiment";
    this.lastError = null;

    const pending = this.runPipeline(runId, startedAt);
    this.busyPromise = pending;
    return pending;
  }

  /**
   * Execute the six-stage pipeline sequentially. Each stage wraps its
   * work in a local try/catch that routes to `fail`, which records state,
   * logs the structured failure record, and throws a
   * `generationFailed(stage, cause)` BackendError.
   *
   * On success the runner transitions to `"completed"` with
   * `stage = null`, stores the new `ReportMetadata`, clears
   * `busyPromise`, and returns the metadata.
   */
  private async runPipeline(
    runId: string,
    startedAt: string,
  ): Promise<ReportMetadata> {
    try {
      // -------------------------- Stage 1: sentiment --------------------
      this.stage = "sentiment";
      const body = await this.runSentimentStage();

      // -------------------------- Stage 2: title ------------------------
      this.stage = "title";
      const titleOutput = await this.runTitleStage(body);

      // -------------------------- Stage 3: titleValidation --------------
      this.stage = "titleValidation";
      const validated = this.runTitleValidationStage(titleOutput);

      // -------------------------- Stage 4: slugResolution ---------------
      this.stage = "slugResolution";
      const finalSlug = await this.runSlugResolutionStage(validated.slug);

      // -------------------------- Stage 5: persist ----------------------
      this.stage = "persist";
      const metadata: ReportMetadata = {
        id: runId,
        title: validated.title,
        slug: finalSlug,
        generatedAt: startedAt,
        prompt: SENTIMENT_PROMPT,
      };
      await this.runPersistStage({ metadata, body });

      // -------------------------- Stage 6: reindex ----------------------
      this.stage = "reindex";
      await this.runReindexStage();

      // -------------------------- Success -------------------------------
      this.status = "completed";
      this.stage = null;
      this.lastError = null;
      this.lastMetadata = metadata;
      this.busyPromise = null;
      return metadata;
    } catch (err) {
      // On any thrown `BackendError` with code `GENERATION_FAILED` the
      // state has already been recorded by the individual stage handler.
      // For any other escaping error (defense in depth) we still need to
      // record state and emit the structured log record.
      if (!this.isAlreadyRecordedFailure(err)) {
        const fallbackStage: GenerationStage = this.stage ?? "sentiment";
        this.recordFailure(runId, fallbackStage, err);
        this.busyPromise = null;
        throw generationFailed(fallbackStage, err);
      }
      this.busyPromise = null;
      throw err;
    }
  }

  // ---------------------- Stage implementations --------------------------

  /**
   * Stage 1 — `sentiment`: dynamically import the sibling Sentiment Agent
   * (READ-ONLY from strands-agent-typescript, Req 14.3), invoke it with
   * the default prompt, and return the concatenated Markdown body. Any
   * failure (module resolution, missing export, SDK error, empty output)
   * is surfaced as a `sentiment`-stage failure.
   */
  private async runSentimentStage(): Promise<string> {
    try {
      const mod = await loadSentimentAgentModule();
      const agent = mod.createHackerNewsSentimentAgent();
      const result = await agent.invoke(SENTIMENT_PROMPT);
      const body = extractMarkdownFromAgentResult(result);
      if (body.length === 0) {
        throw new Error(
          "Sentiment agent returned an empty Markdown body; nothing to persist.",
        );
      }
      return body;
    } catch (cause) {
      this.recordFailureForActiveStage("sentiment", cause);
      throw generationFailed("sentiment", cause);
    }
  }

  /**
   * Stage 2 — `title`: ask the Title Agent to propose a `{ title, slug }`
   * pair for the provided Markdown body. `invokeTitleAgent` internally
   * Zod-validates the output; we re-validate in stage 3 as a final check.
   */
  private async runTitleStage(
    body: string,
  ): Promise<{ readonly title: string; readonly slug: string }> {
    try {
      return await invokeTitleAgent(body);
    } catch (cause) {
      this.recordFailureForActiveStage("title", cause);
      throw generationFailed("title", cause);
    }
  }

  /**
   * Stage 3 — `titleValidation`: defensively re-validate the pair against
   * `TitleAgentOutputSchema`. Surfaces every Zod issue joined into a
   * single message for the structured failure record.
   */
  private runTitleValidationStage(titleOutput: {
    readonly title: string;
    readonly slug: string;
  }): { readonly title: string; readonly slug: string } {
    const parsed = TitleAgentOutputSchema.safeParse(titleOutput);
    if (parsed.success) {
      return parsed.data;
    }
    const message = parsed.error.issues
      .map((issue) => {
        const pathLabel =
          issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${pathLabel}: ${issue.message}`;
      })
      .join("; ");
    const cause = new Error(message);
    this.recordFailureForActiveStage("titleValidation", cause);
    throw generationFailed("titleValidation", cause);
  }

  /**
   * Stage 4 — `slugResolution`: read the currently-published
   * Report_Index, build a set of every existing slug, and resolve any
   * collision via `resolveSlugCollision`. A `null` result (every suffix
   * taken) is a `slugResolution`-stage failure per Req 11.7.
   */
  private async runSlugResolutionStage(proposedSlug: string): Promise<Slug> {
    try {
      if (!isValidSlug(proposedSlug)) {
        throw new Error(
          `Proposed slug "${proposedSlug}" does not satisfy the slug regex.`,
        );
      }
      const existing = await readExistingSlugs();
      const finalSlug = resolveSlugCollision(proposedSlug, existing);
      if (finalSlug === null) {
        throw new Error(
          `Slug "${proposedSlug}" and every suffix -2..-999 are already taken.`,
        );
      }
      return finalSlug;
    } catch (cause) {
      this.recordFailureForActiveStage("slugResolution", cause);
      throw generationFailed("slugResolution", cause);
    }
  }

  /**
   * Stage 5 — `persist`: write `<finalSlug>.md` into the authoritative
   * `strands-agent-typescript/reports/` folder via `persistReport`, which
   * already cleans up partial files on failure (Req 8.6).
   */
  private async runPersistStage(args: {
    readonly metadata: ReportMetadata;
    readonly body: string;
  }): Promise<void> {
    try {
      await persistReport({
        id: args.metadata.id,
        title: args.metadata.title,
        slug: args.metadata.slug,
        generatedAt: args.metadata.generatedAt,
        prompt: args.metadata.prompt,
        body: args.body,
      });
    } catch (cause) {
      this.recordFailureForActiveStage("persist", cause);
      throw generationFailed("persist", cause);
    }
  }

  /**
   * Stage 6 — `reindex`: invoke `runPrebuildIndexer()` in-process so
   * `public/reports/` reflects the new on-disk state. Deliberately
   * NEVER called on an earlier-stage failure (Req 7.2).
   */
  private async runReindexStage(): Promise<void> {
    try {
      await runPrebuildIndexer();
    } catch (cause) {
      this.recordFailureForActiveStage("reindex", cause);
      throw generationFailed("reindex", cause);
    }
  }

  // ---------------------- Failure bookkeeping ----------------------------

  /**
   * Transition to `failed`, record `{ stage, message, cause }`, and emit
   * the single-line JSON structured failure record to stderr. `runId`
   * and `startedAt` are preserved as-is.
   *
   * Callers are expected to throw `generationFailed(stage, cause)`
   * immediately after invoking this method.
   */
  private recordFailureForActiveStage(
    stage: GenerationStage,
    cause: unknown,
  ): void {
    if (this.runId === null) {
      // Defensive: `start()` always sets `runId` before reaching a stage;
      // this branch should be unreachable in practice.
      return;
    }
    this.recordFailure(this.runId, stage, cause);
  }

  private recordFailure(
    runId: string,
    stage: GenerationStage,
    cause: unknown,
  ): void {
    const message = describeError(cause);
    this.status = "failed";
    this.stage = stage;
    this.lastError = { stage, message, cause };
    console.error(
      JSON.stringify({
        level: "error",
        runId,
        stage,
        message,
        ts: new Date().toISOString(),
      }),
    );
  }

  /**
   * A thrown value is "already recorded" when it is a BackendError of
   * code `GENERATION_FAILED` — i.e. was produced by one of the stage
   * handlers above — so the outer catch in `runPipeline` knows not to
   * double-record state or emit a duplicate log line.
   */
  private isAlreadyRecordedFailure(err: unknown): boolean {
    if (typeof err !== "object" || err === null) {
      return false;
    }
    const maybeCode = (err as { code?: unknown }).code;
    return maybeCode === "GENERATION_FAILED";
  }

  /**
   * Snapshot the current state as a `GenerationState` discriminated
   * union, suitable for JSON serialization by the optional
   * `GET /__api/generate` polling endpoint.
   */
  getState(): GenerationState {
    switch (this.status) {
      case "idle":
        return { status: "idle" };
      case "running": {
        if (
          this.runId === null ||
          this.startedAt === null ||
          this.stage === null
        ) {
          // Defensive fallback; should be unreachable while `running`.
          return { status: "idle" };
        }
        return {
          status: "running",
          stage: this.stage,
          runId: this.runId,
          startedAt: this.startedAt,
        };
      }
      case "completed": {
        if (
          this.runId === null ||
          this.startedAt === null ||
          this.lastMetadata === null
        ) {
          return { status: "idle" };
        }
        return {
          status: "completed",
          metadata: this.lastMetadata,
          runId: this.runId,
          startedAt: this.startedAt,
        };
      }
      case "failed": {
        if (
          this.runId === null ||
          this.startedAt === null ||
          this.lastError === null
        ) {
          return { status: "idle" };
        }
        return {
          status: "failed",
          stage: this.lastError.stage,
          message: this.lastError.message,
          runId: this.runId,
          startedAt: this.startedAt,
        };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Module-scoped singleton
// ---------------------------------------------------------------------------

/**
 * Module-scoped singleton captured by `getGenerationRunner`. The Vite
 * generation plugin (task 11.1) keeps a reference to this instance in its
 * closure so every `/__api/generate` request in the same Node process
 * operates on the same state machine (Req 6.1, 6.2).
 */
let singleton: GenerationRunner | null = null;

/** Return the shared module-scoped `GenerationRunner`, creating it lazily. */
export function getGenerationRunner(): GenerationRunner {
  if (singleton === null) {
    singleton = new GenerationRunner();
  }
  return singleton;
}

/**
 * Convenience accessor used by the optional `GET /__api/generate` polling
 * endpoint. Returns the current state as a `GenerationState`
 * discriminated union.
 */
export function getGenerationState(): GenerationState {
  return getGenerationRunner().getState();
}
