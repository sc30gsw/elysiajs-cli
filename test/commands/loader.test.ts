import { resolve } from "path";

import { describe, it, expect } from "vitest";

import { resolveEntryPath } from "~/utils/loader.js";

describe("resolveEntryPath", () => {
  it("should resolve a valid file path", () => {
    const fixturesDir = resolve(import.meta.dirname, "../fixtures");
    const result = resolveEntryPath(`${fixturesDir}/basic-app.ts`);
    expect(result).toBe(`${fixturesDir}/basic-app.ts`);
  });

  it("should throw for non-existent file", () => {
    expect(() => resolveEntryPath("/non/existent/path.ts")).toThrow("Entry file not found");
  });

  it("should try adding .ts extension", () => {
    const fixturesDir = resolve(import.meta.dirname, "../fixtures");
    // Pass path without extension
    const result = resolveEntryPath(`${fixturesDir}/basic-app`);
    expect(result).toBe(`${fixturesDir}/basic-app.ts`);
  });
});
