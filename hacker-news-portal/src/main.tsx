import "./styles/tokens.css";

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
