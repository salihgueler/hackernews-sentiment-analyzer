import type { ReactElement } from "react";
import { Outlet } from "react-router-dom";

import { GenerateReportButton } from "../../features/generate/GenerateReportButton";
import {
  GenerationStatusBanner,
  GenerationStatusProvider,
} from "../../features/generate/GenerationStatus";
import { SectionLabel } from "../../ui/SectionLabel";
import { Sidebar } from "./Sidebar";

import "./Layout.css";

// ---------------------------------------------------------------------------
// Layout — Portal shell rendered on every route.
//
// Structure:
//   <GenerationStatusProvider>
//     <header class="app-header">
//       <div class="app-header__brand">
//         <SectionLabel>Hacker News · Sentiment Archive</SectionLabel>
//         <h1 class="app-header__title">Hacker News Portal</h1>
//       </div>
//       <GenerateReportButton />
//     </header>
//     <div class="app-body">
//       <Sidebar />
//       <main id="main" class="app-main">
//         <GenerationStatusBanner />   <-- above the active view
//         <Outlet />                   <-- nested route content or errorElement
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
//   - `<main id="main" class="app-main">` carries the standard landmark so
//     keyboard users can reach it via the implicit "main" navigation
//     target.
//
// Styling is owned by the co-located `Layout.css` stylesheet, so the
// shell inherits the Portal palette, focus ring, and reduced-motion
// defaults from `styles/tokens.css` while all per-component visual
// details stay in one place.
// ---------------------------------------------------------------------------

export function Layout(): ReactElement {
  return (
    <GenerationStatusProvider>
      <header className="app-header">
        <div className="app-header__brand">
          <SectionLabel>Hacker News · Sentiment Archive</SectionLabel>
          <h1 className="app-header__title reveal-1">Hacker News Portal</h1>
        </div>
        <GenerateReportButton />
      </header>
      <div className="app-body">
        <Sidebar />
        <main id="main" className="app-main">
          <GenerationStatusBanner />
          <Outlet />
        </main>
      </div>
    </GenerationStatusProvider>
  );
}

export default Layout;
