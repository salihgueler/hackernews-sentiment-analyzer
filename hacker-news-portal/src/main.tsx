import "./styles/tokens.css";
import "./styles/motion.css";

// ---------------------------------------------------------------------------
// Self-hosted font loading.
//
// Each fontsource-variable package ships several axis-specific CSS files.
// We import only each font's `wght.css` variant, which declares a single
// `@font-face` for the upright weight axis and is therefore the smallest
// payload that still gives us the full 100..900 range we style through
// the tokens. Italic-only axes (`wght-italic.css`) and foundry-specific
// extras (Fraunces' `opsz.css`, `soft.css`, `wonk.css`) are NOT imported
// so no woff2 beyond the upright weight axis ships to the browser.
//
// Import order matters: these run AFTER `./styles/tokens.css` above so
// tokens that reference the font families can resolve the rule set, but
// on the critical path so the first paint already knows the font
// families exist.
// ---------------------------------------------------------------------------
import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/inter-tight/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import AppRoutes from "./app/routes";

// ---------------------------------------------------------------------------
// main.tsx — Portal browser entry point.
//
// Import order matters:
//   1. `./styles/tokens.css` is imported FIRST so the global design tokens
//      and base resets are registered before any component mounts. This is
//      the single global stylesheet for the Portal (design §12 tokens).
//   2. React runtime, the DOM root creator, and the top-level `AppRoutes`
//      component follow.
//
// Why no `<BrowserRouter>`:
//   `src/app/routes.tsx` already builds its router via `createBrowserRouter`
//   and renders it through `<RouterProvider>` inside `AppRoutes`. Wrapping
//   `<AppRoutes />` in a second `<BrowserRouter>` here would nest two router
//   providers and break React Router v6. So we mount `<AppRoutes />`
//   directly under `<StrictMode>`.
//
// Module-dependency invariant (Req 14.3, 17.2):
//   This file imports only `./styles/tokens.css` and `./app/routes`. Neither
//   transitively pulls in `src/generation/`, `scripts/`, or `plugins/`, so
//   no Node-only code ships into the browser bundle.
// ---------------------------------------------------------------------------

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppRoutes />
  </StrictMode>,
);
