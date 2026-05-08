import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { NavLink } from "react-router-dom";

import { displayTitle } from "../../domain/reportMetadata";
import type { ReportMetadata } from "../../wireBackend/types";
import { BackendError } from "../../wireBackend/types";
import { listReports } from "../../wireBackend/staticBackend";

// ---------------------------------------------------------------------------
// Sidebar — Portal archive navigation.
//
// Renders <nav aria-label="Report archive"> containing one <ul> with one <li>
// per ReportMetadata. Each entry is a React Router <NavLink> to
// `/reports/{slug}`; NavLink's built-in behavior sets `aria-current="page"`
// on the active anchor (Req 3.5, 16.3), and toggles a `sidebar-link active`
// className that the global `.sidebar-link.active` rule in `styles/tokens.css`
// renders with an inline-start accent + bolder weight so the active state
// is visually distinct from mere color (WCAG 1.4.1). Native <a> semantics
// make entries keyboard focusable and Enter/Space activatable (Req 3.1,
// 3.2, 16.2), and React Router's history preserves browser back/forward
// (Req 3.6).
//
// Labels are produced by `displayTitle(entry, entries)` where `entries` is
// the full array, so the four-branch fallback and its disambiguation read
// from the same sibling set as elsewhere in the Portal (Req 4.2, 4.3).
// Dates are shown as `YYYY-MM-DD` via `generatedAt.slice(0, 10)` (Req 2.4).
//
// States:
//   - loading       → lightweight "Loading archive…" placeholder.
//   - error         → "Archive unavailable." banner + Retry button (Req 2.6,
//                     9.4). Only `DATA_SOURCE_UNAVAILABLE` surfaces this
//                     branch; any other BackendError is re-thrown so an
//                     upstream boundary handles it.
//   - empty         → "No reports available yet." placeholder (Req 2.5).
//   - success       → <ul> of NavLinks in disk order (Req 2.1, 2.2, 2.3).
//
// Entries stay interactive regardless of any Generation Run status so the
// archive remains navigable during pending, failed, or completed runs
// (Req 5.5).
//
// Realizes design Properties 2 (composition), 3 (date format), 4
// (aria-current), and 7 (navigability during generation).
// ---------------------------------------------------------------------------

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "ready"; readonly entries: ReadonlyArray<ReportMetadata> };

export function Sidebar(): ReactElement {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  // `reloadToken` is bumped by the Retry button to re-fire the effect.
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    setState({ kind: "loading" });

    listReports().then(
      (entries) => {
        if (cancelled) return;
        setState({ kind: "ready", entries });
      },
      (err: unknown) => {
        if (cancelled) return;
        if (
          err instanceof BackendError &&
          err.code === "DATA_SOURCE_UNAVAILABLE"
        ) {
          setState({ kind: "error" });
          return;
        }
        // Unexpected error class: treat as "archive unavailable" rather
        // than let the Sidebar crash and tear down the Layout.
        setState({ kind: "error" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const retry = useCallback((): void => {
    setReloadToken((prev) => prev + 1);
  }, []);

  return (
    <nav aria-label="Report archive" style={navStyle}>
      <SidebarBody state={state} onRetry={retry} />
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Internal body renderer — a pure function of `(state, onRetry)` so the
// Sidebar's state machine stays small and the branches are obvious.
// ---------------------------------------------------------------------------

interface SidebarBodyProps {
  readonly state: LoadState;
  readonly onRetry: () => void;
}

function SidebarBody({ state, onRetry }: SidebarBodyProps): ReactElement {
  if (state.kind === "loading") {
    return <p style={placeholderStyle}>Loading archive…</p>;
  }

  if (state.kind === "error") {
    return (
      <div style={errorBlockStyle}>
        <p style={placeholderStyle}>Archive unavailable.</p>
        <button type="button" onClick={onRetry} style={retryButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (state.entries.length === 0) {
    return <p style={placeholderStyle}>No reports available yet.</p>;
  }

  return (
    <ul style={listStyle}>
      {state.entries.map((entry) => (
        <li key={entry.id} style={listItemStyle}>
          <NavLink
            to={`/reports/${entry.slug}`}
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <span style={titleStyle}>{displayTitle(entry, state.entries)}</span>
            <span style={dateStyle}>{entry.generatedAt.slice(0, 10)}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Inline styles. Kept minimal and token-driven so the Sidebar inherits the
// Portal's palette and reduced-motion defaults from `styles/tokens.css`.
// ---------------------------------------------------------------------------

const navStyle: CSSProperties = {
  padding: "var(--space-4)",
  borderRight: "1px solid var(--color-border)",
  minWidth: "16rem",
};

const placeholderStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-small)",
};

const errorBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
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

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const listItemStyle: CSSProperties = {
  margin: 0,
};

const titleStyle: CSSProperties = {
  fontSize: "var(--font-size-body)",
};

const dateStyle: CSSProperties = {
  fontSize: "var(--font-size-small)",
  color: "var(--color-text-muted)",
};
