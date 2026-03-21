import { describe, it, expect } from "vitest";

import { formatMethod, formatStatus, formatSize, elapsed } from "~/utils/display.js";

const ansiColorPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const stripAnsi = (s: string) => s.replace(ansiColorPattern, "");

describe("formatMethod", () => {
  it("should format HTTP methods with padding", () => {
    const get = formatMethod("GET");
    const plain = stripAnsi(get);
    expect(plain.trim()).toBe("GET");
    expect(plain.length).toBeGreaterThanOrEqual(7);
  });

  it("should handle all common HTTP methods", () => {
    const methods = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ] as const satisfies readonly string[];

    for (const method of methods) {
      const result = formatMethod(method);
      expect(result).toBeTruthy();
    }
  });

  it("should uppercase method names", () => {
    const result = formatMethod("get");
    const plain = stripAnsi(result);
    expect(plain.trim()).toBe("GET");
  });
});

describe("formatStatus", () => {
  it("should handle 2xx status codes", () => {
    const result = formatStatus(200);
    const plain = stripAnsi(result);
    expect(plain).toBe("200");
  });

  it("should handle 3xx status codes", () => {
    const result = formatStatus(301);
    expect(result).toBeTruthy();
  });

  it("should handle 4xx status codes", () => {
    const result = formatStatus(404);
    const plain = stripAnsi(result);
    expect(plain).toBe("404");
  });

  it("should handle 5xx status codes", () => {
    const result = formatStatus(500);
    const plain = stripAnsi(result);
    expect(plain).toBe("500");
  });
});

describe("formatSize", () => {
  it("should format bytes", () => {
    expect(formatSize(512)).toBe("512 B");
  });

  it("should format kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(2048)).toBe("2.0 KB");
  });

  it("should format megabytes", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("elapsed", () => {
  it("should format milliseconds under 1000ms", () => {
    expect(elapsed(500)).toBe("500ms");
    expect(elapsed(999)).toBe("999ms");
  });

  it("should format seconds for 1000ms and above", () => {
    expect(elapsed(1000)).toBe("1.00s");
    expect(elapsed(2500)).toBe("2.50s");
  });
});
