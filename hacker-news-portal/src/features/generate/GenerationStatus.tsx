import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { GenerationStage } from "../../wireBackend/types";

// ---------------------------------------------------------------------------
// GenerationStatus — shared banner / progress indicator for Generation Runs.
//
// Any component (today `GenerateReportButton`, tomorrow any other caller) can
// write into this module-scoped context to surface one of the three non-idle
// statuses:
//   - "progress"           transient progress indicator while a run is active
//                          (Req 5.3; rendered as a role="status" text element
//                          so screen readers announce it and so the message
//                          remains readable when motion is suppressed per
//                          Req 16.5).
//   - "in-progress-banner" persistent "A generation is already running"
//                          message, stays until dismissed (Req 6.3, 6.4).
//   - "error"              persistent error message with an optional stage
//                          and a user-visible reason, stays until dismissed
//                          (Req 5.6, 7.3, 7.4).
//
// Rendering is split in two:
//   - `GenerationStatusProvider` owns the shared state and exposes setters
//     through `GenerationStatusContext`. It renders only `{children}`.
//   - `GenerationStatusBanner` is a standalone component that consumes the
//     same context and renders the role="status"/role="alert" region.
//     Call sites mount it where the banner should appear in the visual
//     flow. The Portal Layout places it inside `<main>` above `<Outlet />`
//     so the notice sits above the active view rather than below it.
//
// The simplest composition is therefore:
//
//     <GenerationStatusProvider>
//       <Header />
//       <main>
//         <GenerationStatusBanner />
//         <Outlet />
//       </main>
//     </GenerationStatusProvider>
// ---------------------------------------------------------------------------

/** Discriminated union describing the banner's visible state. */
export type GenerationStatusState =
  | { readonly kind: "idle" }
  | { readonly kind: "progress" }
  | { readonly kind: "in-progress-banner" }
  | {
      readonly kind: "error";
      readonly stage?: GenerationStage;
      readonly message: string;
    };

/** Arguments accepted by `setError`. */
export interface SetErrorArgs {
  readonly stage?: GenerationStage;
  readonly message: string;
}

/**
 * Shape of the shared context. Setter identities are stable across renders
 * so consumers can safely include them in dependency arrays.
 */
export interface GenerationStatusContextValue {
  readonly state: GenerationStatusState;
  readonly setProgress: () => void;
  readonly setInProgressBanner: () => void;
  readonly setError: (args: SetErrorArgs) => void;
  readonly clear: () => void;
}

export const GenerationStatusContext =
  createContext<GenerationStatusContextValue | null>(null);

/**
 * Hook for consuming the shared generation status. Must be called under a
 * `<GenerationStatusProvider>`; throws otherwise so the programmer notices
 * immediately rather than silently getting a no-op status.
 */
export function useGenerationStatus(): GenerationStatusContextValue {
  const ctx = useContext(GenerationStatusContext);
  if (ctx === null) {
    throw new Error(
      "useGenerationStatus must be used inside <GenerationStatusProvider>.",
    );
  }
  return ctx;
}

export interface GenerationStatusProviderProps {
  readonly children?: ReactNode;
}

/**
 * Provider that owns the generation-status state and exposes setters to
 * descendants. Renders `{children}` only — call sites that want the
 * banner region render `<GenerationStatusBanner />` wherever it should
 * appear in the visual flow.
 */
export function GenerationStatusProvider({
  children,
}: GenerationStatusProviderProps): ReactElement {
  const [state, setState] = useState<GenerationStatusState>({ kind: "idle" });

  const setProgress = useCallback((): void => {
    setState({ kind: "progress" });
  }, []);

  const setInProgressBanner = useCallback((): void => {
    setState({ kind: "in-progress-banner" });
  }, []);

  const setError = useCallback((args: SetErrorArgs): void => {
    // Preserve the "property present only when provided" invariant so
    // `state.stage === undefined` callers and serializers see a clean shape.
    setState(
      args.stage !== undefined
        ? { kind: "error", stage: args.stage, message: args.message }
        : { kind: "error", message: args.message },
    );
  }, []);

  const clear = useCallback((): void => {
    setState({ kind: "idle" });
  }, []);

  const value = useMemo<GenerationStatusContextValue>(
    () => ({ state, setProgress, setInProgressBanner, setError, clear }),
    [state, setProgress, setInProgressBanner, setError, clear],
  );

  return (
    <GenerationStatusContext.Provider value={value}>
      {children}
    </GenerationStatusContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public banner component. Reads the current status from the surrounding
// provider and renders a role="status"/role="alert" region accordingly.
// Returns `null` in the idle state so the Layout flow stays clean
// (rendering-conditional-render: avoid an empty wrapper element).
// ---------------------------------------------------------------------------

export function GenerationStatusBanner(): ReactElement | null {
  const { state, clear } = useGenerationStatus();
  return <GenerationStatusBannerView state={state} clear={clear} />;
}

// ---------------------------------------------------------------------------
// Internal banner renderer. Split out so the provider stays focused on state
// management and the banner remains a pure function of `(state, clear)`.
// ---------------------------------------------------------------------------

interface GenerationStatusBannerViewProps {
  readonly state: GenerationStatusState;
  readonly clear: () => void;
}

function GenerationStatusBannerView({
  state,
  clear,
}: GenerationStatusBannerViewProps): ReactElement | null {
  if (state.kind === "idle") {
    return null;
  }

  if (state.kind === "progress") {
    // role="status" + aria-label so screen readers announce the run.
    // The plain text content is authoritative for a11y; the
    // decorative shimmer rail below is dropped under reduced motion
    // by the global prefers-reduced-motion block in tokens.css
    // without affecting the announcement.
    return (
      <div role="status" aria-label="Generating report" style={progressStyle}>
        Generating report…
        <div className="progress-rail" aria-hidden="true" />
      </div>
    );
  }

  if (state.kind === "in-progress-banner") {
    return (
      <div role="status" style={bannerStyle}>
        <span style={bannerTextStyle}>
          A generation is already running. Please wait for it to finish.
        </span>
        <button
          type="button"
          onClick={clear}
          style={dismissButtonStyle}
          aria-label="Dismiss generation-in-progress notice"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // state.kind === "error"
  const stageSuffix = state.stage !== undefined ? ` during ${state.stage}` : "";
  return (
    <div role="alert" style={errorStyle}>
      <span style={bannerTextStyle}>
        Generation failed{stageSuffix}: {state.message}
      </span>
      <button
        type="button"
        onClick={clear}
        style={dismissButtonStyle}
        aria-label="Dismiss generation error"
      >
        Dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles. Kept minimal and token-driven so global CSS stays optional
// and the banner inherits the Portal's color palette.
// ---------------------------------------------------------------------------

const progressStyle: CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "4px",
  fontSize: "var(--font-size-small)",
  color: "var(--color-text)",
};

const bannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  padding: "var(--space-3) var(--space-4)",
  border: "1px solid var(--color-border)",
  borderRadius: "4px",
  fontSize: "var(--font-size-small)",
  color: "var(--color-text)",
};

const errorStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  padding: "var(--space-3) var(--space-4)",
  border: "1px solid var(--color-error)",
  borderRadius: "4px",
  fontSize: "var(--font-size-small)",
  color: "var(--color-error)",
  background: "var(--color-error-bg)",
};

const bannerTextStyle: CSSProperties = {
  flex: "1 1 auto",
};

const dismissButtonStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "var(--space-1) var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "4px",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};
