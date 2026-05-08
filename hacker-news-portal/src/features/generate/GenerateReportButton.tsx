import { useCallback, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import {
  BackendError,
  invalidateStaticCaches,
  startGeneration,
} from "../../wireBackend";
import { useGenerationStatus } from "./GenerationStatus";

// ---------------------------------------------------------------------------
// GenerateReportButton — primary call-to-action that kicks off a Generation
// Run (Req 5.1, 5.2).
//
// Local state machine is intentionally tiny: `"idle" | "pending"`. The shared
// `GenerationStatus` context owns the "progress", "in-progress banner", and
// "error" surfaces; this component only needs to track whether a request is
// currently in flight so the button can disable itself and report `aria-busy`
// for assistive tech.
//
// Click-handler contract:
//   1. Synchronously transition to `"pending"`, disable the button, and ask
//      the shared context to render the progress indicator so it appears
//      within the 200 ms budget (Req 5.3).
//   2. `await startGeneration()`; every terminal branch re-enables the
//      button by transitioning back to `"idle"` (Req 5.4, 5.6, 7.4).
//   3. Terminal branches:
//        - success              → `clear()` + `invalidateStaticCaches()` +
//                                  `navigate('/reports/<slug>')` (Req 5.4,
//                                  9.3 — belt-and-suspenders complements the
//                                  cache-bust token in `generationClient`).
//        - GENERATION_IN_PROGRESS → `setInProgressBanner()` (Req 6.3, 6.4).
//        - DATA_SOURCE_UNAVAILABLE
//          or GENERATION_FAILED  → `setError({ stage, message })` (Req 5.6,
//                                  7.3, 7.4).
//        - anything else         → `setError({ message })` generic fallback.
//
// The component never renders a blocking DOM overlay, so Sidebar interaction
// remains available in every state (Req 5.5).
// ---------------------------------------------------------------------------

type ButtonState = "idle" | "pending";

export function GenerateReportButton(): ReactElement {
  const [state, setState] = useState<ButtonState>("idle");
  const { setProgress, setInProgressBanner, setError, clear } =
    useGenerationStatus();
  const navigate = useNavigate();

  const handleClick = useCallback((): void => {
    // Guard against double-activation; the `disabled` attribute already
    // suppresses most paths, but touch/keyboard races can slip through.
    if (state === "pending") {
      return;
    }

    // Synchronous transitions so the UI reflects "pending" before the
    // fetch is awaited (Req 5.3).
    setState("pending");
    setProgress();

    void (async (): Promise<void> => {
      try {
        const metadata = await startGeneration();
        // Success branch: clear the progress indicator, drop every static
        // cache, navigate to the new report, re-enable the button.
        clear();
        invalidateStaticCaches();
        navigate(`/reports/${metadata.slug}`);
        setState("idle");
      } catch (err: unknown) {
        if (err instanceof BackendError) {
          if (err.code === "GENERATION_IN_PROGRESS") {
            setInProgressBanner();
          } else if (
            err.code === "DATA_SOURCE_UNAVAILABLE" ||
            err.code === "GENERATION_FAILED"
          ) {
            setError(
              err.stage !== undefined
                ? { stage: err.stage, message: err.message }
                : { message: err.message },
            );
          } else {
            // Defensive: any other BackendError code (e.g. NOT_FOUND) is
            // unexpected from `startGeneration`; surface a generic error
            // rather than silently swallow it.
            setError({ message: "Generation failed: unknown error." });
          }
        } else {
          setError({ message: "Generation failed: unknown error." });
        }
        setState("idle");
      }
    })();
  }, [state, setProgress, setInProgressBanner, setError, clear, navigate]);

  const isPending = state === "pending";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
      style={isPending ? buttonPendingStyle : buttonStyle}
    >
      Generate Report
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline styles. Token-driven so the button inherits the Portal palette and
// respects the global `prefers-reduced-motion` rule from `styles/tokens.css`.
// ---------------------------------------------------------------------------

const buttonStyle: CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  border: "1px solid var(--color-accent)",
  borderRadius: "4px",
  background: "var(--color-accent)",
  color: "var(--color-bg)",
  fontSize: "var(--font-size-body)",
  fontFamily: "inherit",
  cursor: "pointer",
};

const buttonPendingStyle: CSSProperties = {
  ...buttonStyle,
  cursor: "progress",
  opacity: 0.7,
};
