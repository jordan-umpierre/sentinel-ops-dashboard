import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library mounts components into the global jsdom document.
// `cleanup()` unmounts after each test so subsequent tests start with a fresh
// DOM — critical for tests that assert on byRole queries.
afterEach(() => {
  cleanup();
});
