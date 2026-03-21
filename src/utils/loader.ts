import { existsSync, type PathLike } from "fs";
import { resolve, extname } from "path";

import { Result } from "better-result";

import { isBun } from "~/utils/runtime.js";

export interface LoadedApp {
  app: ElysiaApp;
  filePath: string;
}

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
 * @param value - Module export to check
 * @returns `true` if value has a `handle` function and a `routes` array
 */
function isElysiaApp(value: unknown): value is ElysiaApp {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return typeof obj["handle"] === "function" && Array.isArray(obj["routes"]);
}

/**
 * Resolve the entry file path
 * @param entry - Entry file path (relative or absolute)
 * @returns `Ok` with the resolved absolute path, or `Err` if not found
 */
export function resolveEntryPath(entry: string) {
  const abs = resolve(process.cwd(), entry);

  if (existsSync(abs)) {
    return Result.ok(abs);
  }

  const extensions = [".ts", ".tsx", ".js", ".mjs"];
  for (const ext of extensions) {
    const withExt = abs + ext;
    if (existsSync(withExt)) return Result.ok(withExt);
  }

  return Result.err(new Error(`Entry file not found: ${entry}`));
}

/**
 * Transpile TypeScript to JavaScript using esbuild (for Node.js)
 * @param filePath - Path to the TypeScript source file
 * @returns Absolute path to the transpiled `.mjs` output file
 * @throws If esbuild fails to transpile the file
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
    //? Don't externalize elysia so it gets bundled in and works from temp dir
    external: ["bun", "bun:*"],
    sourcemap: "inline",
    logLevel: "silent",
    nodePaths: [path.join(process.cwd(), "node_modules")],
  });

  return outFile;
}

/**
 * Convert file path to file URL
 * @param filePath - Absolute file path (supports Windows and POSIX)
 * @returns `file://` URL string
 */
function pathToFileUrl(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");

  if (normalizedPath.startsWith("/")) {
    return `file://${normalizedPath}`;
  }

  return `file:///${normalizedPath}`;
}

/**
 * Dynamically load an Elysia app from a file
 * @param entry - Entry file path (relative or absolute)
 * @returns `Ok` with the loaded app and resolved file path, or `Err` on failure
 */
export async function loadApp(entry: string) {
  return Result.gen(async function* () {
    const filePath = yield* resolveEntryPath(entry);
    const ext = extname(filePath);

    let modulePath = filePath;

    if (!isBun() && (ext === ".ts" || ext === ".tsx")) {
      modulePath = yield* Result.await(
        Result.tryPromise({
          try: () => transpileWithEsbuild(filePath),
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );
    }

    const moduleUrl = `${pathToFileUrl(modulePath)}?t=${Date.now()}`;
    const module_ = yield* Result.await(
      Result.tryPromise({
        try: () => import(moduleUrl),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      }),
    );

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
