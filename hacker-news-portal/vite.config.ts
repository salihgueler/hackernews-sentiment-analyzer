import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import generationPlugin from "./plugins/generation-plugin";

// https://vite.dev/config/
//
// React Compiler is wired via the official `reactCompilerPreset` helper
// from @vitejs/plugin-react, fed through @rolldown/plugin-babel — that is
// the plugin-react v6 + rolldown-backed Vite pipeline. `target: "19"`
// points the compiler at the React 19 runtime we ship, so the generated
// memoization calls use `react/compiler-runtime` directly.
//
// Compiler output augments existing `useMemo` / `useCallback` calls
// rather than replacing them, so every memo call in the source tree
// stays correct.
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ target: "19" })] }),
    generationPlugin(),
  ],
});
