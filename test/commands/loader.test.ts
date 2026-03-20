import { resolve } from "path";

import { describe, it, expect } from "vitest";

import { resolveEntryPath } from "~/utils/loader.js";

describe("resolveEntryPath", () => {
  it("should resolve a valid file path", () => {
    const fixturesDir = resolve(import.meta.dirname, "../fixtures");
    const result = resolveEntryPath(`${fixturesDir}/basic-app.ts`);
    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value).toBe(`${fixturesDir}/basic-app.ts`);
  });

  it("should return Err for non-existent file", () => {
    const result = resolveEntryPath("/non/existent/path.ts");
    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error.message).toContain("Entry file not found");
  });

  it("should try adding .ts extension", () => {
    const fixturesDir = resolve(import.meta.dirname, "../fixtures");
    // Pass path without extension
    const result = resolveEntryPath(`${fixturesDir}/basic-app`);
    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value).toBe(`${fixturesDir}/basic-app.ts`);
  });
});
