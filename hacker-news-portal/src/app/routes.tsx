import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { sortReportsForDisplay } from "../domain/reportMetadata";
import { EmptyArchiveView } from "../features/reports/EmptyArchiveView";
import { NotFoundView } from "../features/reports/NotFoundView";
import { ReportView } from "../features/reports/ReportView";
import { BackendError } from "../wireBackend/types";
import { listReports } from "../wireBackend/staticBackend";
import { Layout } from "./layout/Layout";

// ---------------------------------------------------------------------------
// routes.tsx — React Router v6 configuration for the Portal.
//
// Route tree:
//   /                              -> Layout (element)
//   ├── index                      -> LandingRoute (renders latest report)
//   ├── reports/:slug              -> ReportView
//   └── *                          -> NotFoundView
//
// Layout is the `element` of the top-level route; every child route renders
// inside its <Outlet />. `errorElement` is attached at the top-level so any
// render-time exception thrown under the Outlet is caught by `ErrorFallback`
// while the Layout (header + Sidebar) remains on screen (Req 1.5, 3.4).
//
// The landing route keeps the URL at `/` and picks the most recent report
// via `sortReportsForDisplay` (Req 1.1, design Property 1). An empty index
// renders `EmptyArchiveView` in the main view (Req 1.4); a
// `DATA_SOURCE_UNAVAILABLE` rejection renders a main-view banner with
// `role="alert"` (Req 9.4) — the Sidebar is a sibling in Layout, so it
// renders its own error/empty states independently.
//
// Realizes design Properties 1 (landing selection) and 5 (route resolution).
// ---------------------------------------------------------------------------

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorFallback />,
    children: [
      { index: true, element: <LandingRoute /> },
      { path: "reports/:slug", element: <ReportView /> },
      { path: "*", element: <NotFoundView /> },
    ],
  },
]);

/**
 * Top-level Routes component wrapping `<RouterProvider>`. `main.tsx` mounts
 * this under `<StrictMode>` so the router drives the whole Portal.
 */
export function AppRoutes(): ReactElement {
  return <RouterProvider router={router} />;
}

export default AppRoutes;

// ---------------------------------------------------------------------------
// LandingRoute — "/" handler.
//
// Responsibilities:
//   1. Fetch the Report_Index via `listReports()`.
//   2. Select the first entry of `sortReportsForDisplay(entries)` — that is
//      the most recent generatedAt, with slug tie-breaker (Req 1.1,
//      Property 1).
//   3. Render `<ReportView slug={selected.slug} />` while keeping the URL at
//      "/" (ReportView honors the `slug` prop over the route param so no
//      navigation is needed).
//   4. Render `EmptyArchiveView` when the index has zero entries (Req 1.4).
//   5. Render a main-view `<p role="alert">Archive unavailable.</p>` on a
//      `DATA_SOURCE_UNAVAILABLE` rejection. The Sidebar is a sibling in
//      Layout; this branch is only responsible for the main-view message
//      (Req 9.4).
// ---------------------------------------------------------------------------

type LandingState =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ready"; readonly slug: string };

function LandingRoute(): ReactElement {
  const [state, setState] = useState<LandingState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    setState({ kind: "loading" });

    listReports().then(
      (entries) => {
        if (cancelled) return;
        if (entries.length === 0) {
          setState({ kind: "empty" });
          return;
        }
        const sorted = sortReportsForDisplay(entries);
        const first = sorted[0];
        if (first === undefined) {
          // Defensive: `sortReportsForDisplay` preserves length, so this
          // branch is unreachable. Fall back to the empty state rather than
          // crash.
          setState({ kind: "empty" });
          return;
        }
        setState({ kind: "ready", slug: first.slug });
      },
      (err: unknown) => {
        if (cancelled) return;
        if (
          err instanceof BackendError &&
          err.code === "DATA_SOURCE_UNAVAILABLE"
        ) {
          setState({ kind: "unavailable" });
          return;
        }
        // Any other class of error degrades to the same "unavailable"
        // banner rather than tearing down the Layout.
        setState({ kind: "unavailable" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <section style={sectionStyle}>
        <p style={placeholderStyle}>Loading archive…</p>
      </section>
    );
  }

  if (state.kind === "empty") {
    return <EmptyArchiveView />;
  }

  if (state.kind === "unavailable") {
    return (
      <section style={sectionStyle}>
        <p role="alert" style={alertStyle}>
          Archive unavailable.
        </p>
      </section>
    );
  }

  return <ReportView slug={state.slug} />;
}

// ---------------------------------------------------------------------------
// ErrorFallback — router-level `errorElement`.
//
// Rendered inside the Layout's <Outlet /> when a descendant route throws
// during render or data loading, so the header and Sidebar stay intact
// (Req 1.5, 3.4). The copy is intentionally generic; more specific banners
// ("Report could not be loaded", "Archive unavailable") are surfaced by the
// views themselves.
// ---------------------------------------------------------------------------

function ErrorFallback(): ReactElement {
  const handleRetry = (): void => {
    // A hard reload is the simplest way to reset the Portal's in-memory
    // caches and retry every in-flight fetch without building route-specific
    // recovery logic here.
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <section style={sectionStyle}>
      <p role="alert" style={alertStyle}>
        Something went wrong.
      </p>
      <button type="button" onClick={handleRetry} style={retryButtonStyle}>
        Retry
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline styles.
// ---------------------------------------------------------------------------

const sectionStyle: CSSProperties = {
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

const placeholderStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
};

const alertStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text)",
};

const retryButtonStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "var(--space-1) var(--space-3)",
  border: "1px solid var(--color-border)",
  borderRadius: "4px",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};
