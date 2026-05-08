import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";

import { displayTitle, groupByRecency } from "../../domain/reportMetadata";
import type { GroupedReports } from "../../domain/reportMetadata";
import type { ReportMetadata } from "../../wireBackend/types";
import { BackendError } from "../../wireBackend/types";
import { listReports, preloadReport } from "../../wireBackend/staticBackend";
import { Button } from "../../ui/Button";
import { SectionLabel } from "../../ui/SectionLabel";
import { Skeleton } from "../../ui/Skeleton";

import "./Sidebar.css";

// ---------------------------------------------------------------------------
// Sidebar — Portal archive navigation.
//
// Renders `<nav aria-label="Report archive">` containing one labeled
// section per non-empty recency bucket (Today / This week / Earlier) plus
// one `<ul>` of `<NavLink>` entries per section. NavLink toggles the
// `sidebar-link active` className on the current route; the global
// `.sidebar-link.active` rule in `styles/tokens.css` applies the
// inline-start accent plus bolder weight. aria-current="page" is still
// emitted by React Router (Req 3.5, 16.3).
//
// Each entry's label is produced by `displayTitle(entry, entries)` where
// `entries` is the full array, so the four-branch title fallback reads
// from the same sibling set as elsewhere in the Portal (Req 4.2, 4.3).
// Dates are shown as `YYYY-MM-DD` via `generatedAt.slice(0, 10)`
// (Req 2.4). The slug appears beneath the date in the mono font.
//
// Preload: on `onMouseEnter` / `onFocus` for each entry we fire a
// non-awaited `preloadReport(slug)` from `wireBackend/staticBackend.ts`
// so the Markdown body is already in the LRU cache by the time the
// Visitor clicks.
//
// States:
//   - loading   → three Skeleton rows inside a single group placeholder.
//   - error     → "Archive unavailable." banner + Retry button
//                 (Req 2.6, 9.4). Only `DATA_SOURCE_UNAVAILABLE`
//                 surfaces this branch; any other BackendError is still
//                 treated as archive-unavailable rather than left to
//                 crash the Sidebar (the Layout's errorElement is for
//                 route errors, not sibling errors).
//   - empty     → "No reports available yet." placeholder (Req 2.5).
//   - success   → grouped `<ul>` sections (Req 2.1, 2.2, 2.3).
//
// Entries stay interactive regardless of any Generation Run status so
// the archive remains navigable during pending, failed, or completed
// runs (Req 5.5).
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
    <nav aria-label="Report archive" className="sidebar">
      <SidebarBody state={state} onRetry={retry} />
    </nav>
  );
}

interface SidebarBodyProps {
  readonly state: LoadState;
  readonly onRetry: () => void;
}

function SidebarBody({ state, onRetry }: SidebarBodyProps): ReactElement {
  if (state.kind === "loading") {
    return SIDEBAR_LOADING_PLACEHOLDER;
  }

  if (state.kind === "error") {
    return (
      <div className="sidebar__error">
        <p className="sidebar__placeholder">Archive unavailable.</p>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (state.entries.length === 0) {
    return <p className="sidebar__placeholder">No reports available yet.</p>;
  }

  return <SidebarGroups entries={state.entries} />;
}

// ---------------------------------------------------------------------------
// SidebarGroups — renders the three recency buckets.
//
// `groupByRecency` runs once per `entries` change via `useMemo`. `now`
// is captured from `Date.now()` at render time; the helper is pure so
// the result is stable for the rest of the render pass.
// ---------------------------------------------------------------------------

interface SidebarGroupsProps {
  readonly entries: ReadonlyArray<ReportMetadata>;
}

function SidebarGroups({ entries }: SidebarGroupsProps): ReactElement {
  const grouped = useMemo<GroupedReports>(
    () => groupByRecency(entries, Date.now()),
    [entries],
  );

  // Apply the `.reveal-2` class to the first non-empty group only so the
  // three reveal targets (masthead h1 → first sidebar section → article
  // header) animate in a consistent cascade.
  let revealConsumed = false;
  const reveal = (): string | undefined => {
    if (revealConsumed) return undefined;
    revealConsumed = true;
    return "reveal-2";
  };

  return (
    <>
      {grouped.today.length > 0 ? (
        <SidebarGroup
          label="Today"
          entries={grouped.today}
          siblings={entries}
          className={reveal()}
        />
      ) : null}
      {grouped.thisWeek.length > 0 ? (
        <SidebarGroup
          label="This week"
          entries={grouped.thisWeek}
          siblings={entries}
          className={reveal()}
        />
      ) : null}
      {grouped.earlier.length > 0 ? (
        <SidebarGroup
          label="Earlier"
          entries={grouped.earlier}
          siblings={entries}
          className={reveal()}
        />
      ) : null}
    </>
  );
}

interface SidebarGroupProps {
  readonly label: string;
  readonly entries: ReadonlyArray<ReportMetadata>;
  readonly siblings: ReadonlyArray<ReportMetadata>;
  readonly className?: string | undefined;
}

function SidebarGroup({
  label,
  entries,
  siblings,
  className,
}: SidebarGroupProps): ReactElement {
  const composedClassName = ["sidebar__group", className]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return (
    <section className={composedClassName}>
      <SectionLabel>{label}</SectionLabel>
      <ul className="sidebar__list">
        {entries.map((entry) => (
          <SidebarItem key={entry.id} entry={entry} siblings={siblings} />
        ))}
      </ul>
    </section>
  );
}

interface SidebarItemProps {
  readonly entry: ReportMetadata;
  readonly siblings: ReadonlyArray<ReportMetadata>;
}

function SidebarItem({ entry, siblings }: SidebarItemProps): ReactElement {
  const handlePrefetch = useCallback((): void => {
    preloadReport(entry.slug);
  }, [entry.slug]);

  return (
    <li className="sidebar__item">
      <NavLink
        to={`/reports/${entry.slug}`}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        className={({ isActive }) =>
          isActive ? "sidebar-link active" : "sidebar-link"
        }
      >
        <span className="sidebar-link__title">
          {displayTitle(entry, siblings)}
        </span>
        <span className="sidebar-link__meta">
          <time dateTime={entry.generatedAt}>
            {entry.generatedAt.slice(0, 10)}
          </time>
          <span aria-hidden="true">·</span>
          <span>{entry.slug}</span>
        </span>
      </NavLink>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Hoisted loading placeholder (rendering-hoist-jsx).
// ---------------------------------------------------------------------------

const SIDEBAR_LOADING_PLACEHOLDER: ReactElement = (
  <div className="sidebar__skeletons" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="sidebar__skeleton-row">
        <Skeleton variant="line" width="80%" />
        <Skeleton variant="line" width="40%" />
      </div>
    ))}
  </div>
);
