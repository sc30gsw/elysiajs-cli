import { describe, it, expect } from "vitest";

import { isBun, getRuntime, getRuntimeVersion, getTsRunner } from "~/utils/runtime.js";

describe("runtime detection", () => {
  it("should detect the current runtime", () => {
    const runtime = getRuntime();
    expect(["bun", "node"]).toContain(runtime);
  });

  it("should return a valid version string", () => {
    const version = getRuntimeVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("should return correct ts runner", () => {
    const runner = getTsRunner();
    if (isBun()) {
      expect(runner).toBe("bun");
    } else {
      expect(runner).toBe("tsx");
    }
  });

  it("isBun should return boolean", () => {
    expect(typeof isBun()).toBe("boolean");
  });
});
