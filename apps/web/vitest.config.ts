import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest uses Vite's transform pipeline so TSX, path resolution, and CSS
// imports all "just work" the same way the dev server resolves them.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
