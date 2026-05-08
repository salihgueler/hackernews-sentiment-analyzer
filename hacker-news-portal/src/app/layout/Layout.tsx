import type { CSSProperties, ReactElement } from "react";
import { Outlet } from "react-router-dom";

import { GenerateReportButton } from "../../features/generate/GenerateReportButton";
import {
  GenerationStatusBanner,
  GenerationStatusProvider,
} from "../../features/generate/GenerationStatus";
import { Sidebar } from "./Sidebar";

// ---------------------------------------------------------------------------
// Layout — Portal shell rendered on every route.
//
// Structure:
//   <GenerationStatusProvider>
//     <header>
//       <h1>Hacker News Portal</h1>
//       <GenerateReportButton />
//     </header>
//     <div class="layout-body">
//       <Sidebar />
//       <main id="main">
//         <GenerationStatusBanner />  <-- above the active view
//         <Outlet />                   <-- nested route content or route errorElement
//       </main>
//     </div>
//   </GenerationStatusProvider>
//
// Why this shape:
//   - `GenerationStatusProvider` wraps the whole shell so the banner region
//     and the `useGenerationStatus` hook are available on both `/` and
//     `/reports/:slug` (Req 5.1, 6.3, 6.4, 7.3). The provider only exposes
//     state; the banner itself is mounted explicitly above `<Outlet />` so
//     progress/error notices sit above the active view and not below it.
//   - `GenerateReportButton` lives in the header so it is visible on every
//     route without being duplicated by each view (Req 5.1).
//   - `Sidebar` is a sibling of `<main>` rather than a child, so a route-level
//     error handled by `errorElement` still keeps the archive visible
//     (Req 1.5, 3.4, 9.4): the error fallback renders inside `<Outlet />`,
//     leaving `<Sidebar />` and the header untouched.
//   - `<main id="main">` carries the standard landmark so keyboard users can
//     reach it via the implicit "main" navigation target.
//
// Inline styles are token-driven so the shell inherits the Portal palette,
// focus ring, and reduced-motion defaults from `styles/tokens.css`.
// ---------------------------------------------------------------------------

export function Layout(): ReactElement {
  return (
    <GenerationStatusProvider>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Hacker News Portal</h1>
        <GenerateReportButton />
      </header>
      <div style={bodyStyle}>
        <Sidebar />
        <main id="main" style={mainStyle}>
          <GenerationStatusBanner />
          <Outlet />
        </main>
      </div>
    </GenerationStatusProvider>
  );
}

export default Layout;

// ---------------------------------------------------------------------------
// Inline styles. Kept local to the component so Layout remains the single
// owner of the shell chrome.
// ---------------------------------------------------------------------------

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-4)",
  padding: "var(--space-4) var(--space-5)",
  borderBottom: "1px solid var(--color-border)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--font-size-heading-1)",
};

const bodyStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  minHeight: "calc(100vh - 5rem)",
};

const mainStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
};
