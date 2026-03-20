import { existsSync, type PathLike } from "fs";
import { resolve, extname } from "path";

import { Result } from "better-result";

import { isBun } from "~/utils/runtime.js";

export interface LoadedApp {
  app: ElysiaApp;
  filePath: string;
}

/**
 * Minimal interface for Elysia app instances
 */
export interface ElysiaApp {
  handle: (request: Request) => Promise<Response>;
  routes: Array<{
    method: string;
    path: string;
    handler: unknown;
    hooks: unknown;
    websocket?: unknown;
  }>;
  fetch: (request: Request) => Promise<Response> | Response;
}

export type ElysiaRoute = ElysiaApp["routes"][number];

/**
 * Check if the given module export is an Elysia app
 */
function isElysiaApp(value: unknown): value is ElysiaApp {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj["handle"] === "function" && Array.isArray(obj["routes"]);
}

/**
 * Resolve the entry file path
 */
export function resolveEntryPath(entry: string): Result<string, Error> {
  const abs = resolve(process.cwd(), entry);

  if (existsSync(abs)) return Result.ok(abs);

  // Try common extensions
  const extensions = [".ts", ".tsx", ".js", ".mjs"];
  for (const ext of extensions) {
    const withExt = abs + ext;
    if (existsSync(withExt)) return Result.ok(withExt);
  }

  return Result.err(new Error(`Entry file not found: ${entry}`));
}

/**
 * Transpile TypeScript to JavaScript using esbuild (for Node.js)
 */
async function transpileWithEsbuild(filePath: PathLike): Promise<string> {
  const esbuild = await import("esbuild");
  const os = await import("os");
  const path = await import("path");
  const fs = await import("fs/promises");

  const outDir = path.join(os.tmpdir(), "elysia-cli", Date.now().toString());
  await fs.mkdir(outDir, { recursive: true });

  const outFile = path.join(outDir, "app.mjs");

  await esbuild.build({
    entryPoints: [String(filePath)],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    // Don't externalize elysia so it gets bundled in and works from temp dir
    external: ["bun", "bun:*"],
    sourcemap: "inline",
    logLevel: "silent",
    nodePaths: [path.join(process.cwd(), "node_modules")],
  });

  return outFile;
}

/**
 * Dynamically load an Elysia app from a file
 */
export async function loadApp(entry: string): Promise<Result<LoadedApp, Error>> {
  return Result.gen(async function* () {
    const filePath = yield* resolveEntryPath(entry);
    const ext = extname(filePath);

    let modulePath = filePath;

    // For Node.js, transpile TypeScript first
    if (!isBun() && (ext === ".ts" || ext === ".tsx")) {
      modulePath = yield* Result.await(
        Result.tryPromise({
          try: () => transpileWithEsbuild(filePath),
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );
    }

    // Dynamic import with cache-busting for watch mode
    const moduleUrl = `${pathToFileUrl(modulePath)}?t=${Date.now()}`;
    const module_ = yield* Result.await(
      Result.tryPromise({
        try: () => import(moduleUrl),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      }),
    );

    // Try default export first, then named 'app' export
    const app = module_.default ?? module_.app;

    if (!isElysiaApp(app)) {
      return Result.err(
        new Error(
          `No valid Elysia app found in "${entry}". ` +
            'Make sure to export your Elysia instance as the default export or as "app".',
        ),
      );
    }

    return Result.ok({ app, filePath });
  });
}

/**
 * Convert file path to file URL
 */
function pathToFileUrl(filePath: string): string {
  // Handle Windows paths
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (normalizedPath.startsWith("/")) {
    return `file://${normalizedPath}`;
  }
  return `file:///${normalizedPath}`;
}
