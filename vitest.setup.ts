import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest.config.ts doesn't set `test.globals`, so RTL's auto-cleanup (which
// relies on detecting a global `afterEach`) never registers on its own.
afterEach(cleanup);
