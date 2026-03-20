import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";
import { Result } from "better-result";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cli = join(root, "dist", "cli.js");

function run(args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, [cli, ...args], {
    encoding: "utf-8",
    cwd: root,
    env: { ...process.env, ...env },
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function waitForHttp(url: string, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let last: { message: string } = new Error("Timeout");
  while (Date.now() < deadline) {
    const result = await Result.tryPromise(() => fetch(url));
    if (result.isOk()) return result.value;
    last = result.error;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(last.message);
}

describe.sequential("elysia CLI (dist/cli.js)", () => {
  beforeAll(() => {
    if (!existsSync(cli)) {
      throw new Error(`Missing ${cli}. Run: bun run build`);
    }
  });

  it("--version", () => {
    const out = run(["--version"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("--help lists all commands", () => {
    const out = run(["--help"]);
    expect(out).toContain("docs");
    expect(out).toContain("search");
    expect(out).toContain("request");
    expect(out).toContain("serve");
    expect(out).toContain("optimize");
  });

  it("help docs shows subcommand usage", () => {
    const out = run(["help", "docs"]);
    expect(out).toContain("docs");
    expect(out).toMatch(/path|cache/i);
  });

  it("request runs against fixture app", () => {
    const out = run(["request", "test/fixtures/basic-app.ts", "http://localhost/"]);
    expect(out).toContain("200");
    expect(out).toContain("Hello Elysia");
  });

  it("req alias matches request", () => {
    const out = run(["req", "test/fixtures/basic-app.ts", "/health"]);
    expect(out).toContain("200");
    expect(out).toContain("ok");
  });

  it("request POST with JSON body", () => {
    const out = run([
      "request",
      "test/fixtures/basic-app.ts",
      "/echo",
      "-m",
      "POST",
      "-H",
      "content-type: application/json",
      "-b",
      '{"hello":"world"}',
    ]);
    expect(out).toContain("200");
    expect(out).toContain("hello");
    expect(out).toContain("world");
  });

  it("optimize --dry-run reports entry", () => {
    const out = run(["optimize", "test/fixtures/basic-app.ts", "--dry-run"]);
    expect(out).toMatch(/dry|Entry/i);
  });

  it("optimize writes bundle to -o path", () => {
    const dir = mkdtempSync(join(tmpdir(), "elysia-cli-opt-"));
    const outFile = join(dir, "bundle.mjs");
    try {
      run(["optimize", "test/fixtures/basic-app.ts", "-o", outFile]);
      expect(existsSync(outFile)).toBe(true);
      expect(readFileSync(outFile, "utf-8").length).toBeGreaterThan(200);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serve --help", () => {
    const out = run(["serve", "--help"]);
    expect(out).toContain("serve");
    expect(out).toMatch(/port|entry/i);
  });

  it("serve starts fixture and responds on HTTP", async () => {
    const port = 38432;
    const child = spawn(
      process.execPath,
      [cli, "serve", "test/fixtures/serve-http-entry.ts", "-p", String(port)],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "ignore"],
        env: { ...process.env },
      },
    );
    try {
      const res = await waitForHttp(`http://127.0.0.1:${port}/`, 25_000);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
    } finally {
      child.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 400));
    }
  }, 35_000);
});

const skipNetwork = process.env.SKIP_NETWORK_CLI === "1";

function extractSearchJsonArray(stdout: string): unknown[] {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start === -1 || end <= start) {
    throw new Error(`Expected JSON array in search output, got:\n${stdout.slice(0, 800)}`);
  }
  const parsed = JSON.parse(stdout.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Search output JSON is not an array");
  }
  return parsed;
}

const networkDescribe = skipNetwork ? describe.skip : describe.sequential;

networkDescribe("elysia CLI (network: docs & search)", () => {
  beforeAll(() => {
    if (!existsSync(cli)) {
      throw new Error(`Missing ${cli}. Run: bun run build`);
    }
  });

  it("docs without path shows help or TOC", () => {
    const home = mkdtempSync(join(tmpdir(), "elysia-cli-docs-toc-"));
    const out = run(["docs"], { HOME: home });
    expect(out.length).toBeGreaterThan(20);
    expect(out).toMatch(/elysia|docs|essential|tutorial|category/i);
  }, 120_000);

  it("docs fetches and renders a page", () => {
    const home = mkdtempSync(join(tmpdir(), "elysia-cli-docs-"));
    const out = run(["docs", "essential/route"], { HOME: home });
    expect(out.length).toBeGreaterThan(50);
    expect(out).toMatch(/route|routing|elysia/i);
  }, 120_000);

  it("search returns JSON hits", () => {
    const home = mkdtempSync(join(tmpdir(), "elysia-cli-search-"));
    const out = run(["search", "validation"], { HOME: home });
    const parsed = extractSearchJsonArray(out);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]).toMatchObject({
      path: expect.stringMatching(/\.md$/),
      title: expect.any(String),
    });
  }, 180_000);

  it("search --pretty prints human-readable results", () => {
    const home = mkdtempSync(join(tmpdir(), "elysia-cli-search-pretty-"));
    const out = run(["search", "route", "--pretty", "-l", "3"], { HOME: home });
    expect(out).toMatch(/search|route|docs|path/i);
    expect(out.length).toBeGreaterThan(30);
  }, 180_000);
});
