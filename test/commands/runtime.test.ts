import { describe, it, expect } from "vitest";

import { isBun } from "~/utils/runtime.js";

function expectedRuntimeLabel(): "bun" | "node" {
  return isBun() ? "bun" : "node";
}

function expectedRuntimeVersion(): string {
  return isBun() ? `Bun ${Bun.version}` : `Node.js ${process.version}`;
}

function expectedTsRunner(): "bun" | "tsx" {
  return isBun() ? "bun" : "tsx";
}

describe("runtime detection", () => {
  it("should detect the current runtime", () => {
    expect(["bun", "node"]).toContain(expectedRuntimeLabel());
  });

  it("should return a valid version string", () => {
    const version = expectedRuntimeVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("should return correct ts runner", () => {
    const runner = expectedTsRunner();

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
