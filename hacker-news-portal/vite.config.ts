import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import generationPlugin from "./plugins/generation-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), generationPlugin()],
});
