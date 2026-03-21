import { statSync, type PathLike } from "fs";
import { resolve, dirname, basename, extname, join } from "path";

import { Result } from "better-result";
import type { Command } from "commander";

import { error, info, success, header, formatSize, exitOnError } from "~/utils/display.js";
import { resolveEntryPath } from "~/utils/loader.js";

const OPTIMIZE_TARGETS = ["bun", "node", "browser"] as const satisfies readonly string[];

type OptimizeTarget = (typeof OPTIMIZE_TARGETS)[number];

interface OptimizeResolvedOptions {
  output: string;
  minify: boolean;
  target: OptimizeTarget;
  analyze: boolean;
  dryRun: boolean;
  external: string[];
}

type OptimizeCliOptionsRaw = Partial<
  Omit<OptimizeResolvedOptions, "target" | "output" | "dryRun"> & {
    target?: string;
    output?: string;
    dryRun?: boolean;
  }
>;

/**
 * Type guard: whether `s` is a valid {@link OPTIMIZE_TARGETS} value.
 * @param s - Raw `--target` string from the CLI
 */
function isOptimizeTarget(s: string): s is OptimizeTarget {
  return (OPTIMIZE_TARGETS as readonly string[]).includes(s);
}

/**
 * Validate and resolve CLI options for a given entry file path.
 * @param filePath - Absolute path to the bundle entry (after CLI entry resolution)
 * @param raw - Partial options from Commander
 * @returns `Ok` with resolved paths and flags, or `Err` if `--target` is invalid
 */
function parseOptimizeOptions(
  filePath: string,
  raw: OptimizeCliOptionsRaw,
): Result<OptimizeResolvedOptions, Error> {
  const targetStr = raw.target ?? "node";
  if (!isOptimizeTarget(targetStr)) {
    return Result.err(
      new Error(`Invalid target: "${targetStr}". Must be one of: ${OPTIMIZE_TARGETS.join(", ")}`),
    );
  }

  const target = targetStr;
  const output = resolveOutputPath(filePath, raw.output);

  return Result.ok({
    output,
    minify: raw.minify ?? false,
    target,
    analyze: raw.analyze ?? false,
    dryRun: raw.dryRun ?? false,
    external: raw.external ?? [],
  } satisfies OptimizeResolvedOptions);
}

/** Packages always passed to esbuild `external` (merged with `-e, --external`). */
const DEFAULT_EXTERNALS = [
  "@sinclair/typebox",
  "file-type",
  "bun",
  "bun:*",
] as const satisfies readonly string[];

/** esbuild `platform` derived from optimize target (`bun` builds use the Node platform). */
const ESBUILD_PLATFORM_BY_TARGET = {
  browser: "browser",
  bun: "node",
  node: "node",
} as const satisfies Record<OptimizeTarget, "browser" | "node">;

/** esbuild `target` string for each optimize target. */
const ESBUILD_TARGET_BY_OPTIMIZE_TARGET = {
  bun: "bun1.0",
  browser: "es2022",
  node: "node20",
} as const satisfies Record<OptimizeTarget, string>;

/**
 * Build output path from entry and options
 * @param entry - Entry file path
 * @param outputOpt - Optional explicit output path (overrides default)
 * @returns Resolved absolute output file path
 */
function resolveOutputPath(entry: string, outputOpt?: string) {
  if (outputOpt) {
    return resolve(process.cwd(), outputOpt);
  }

  const dir = dirname(entry);
  const base = basename(entry, extname(entry));

  return join(dir, "..", "dist", `${base}.js`);
}

/**
 * Get file size safely
 * @param filePath - Path to the file
 * @returns File size in bytes, or `0` if the file does not exist
 */
function getFileSize(filePath: PathLike) {
  return Result.try(() => statSync(filePath).size).unwrapOr(0);
}

/**
 * Run esbuild optimization
 * @param entry - Entry file path to bundle
 * @param output - Output file path for the bundle
 * @param opts - Resolved optimize options (target, minify, externals, etc.)
 * @returns Resolves when the build (or dry-run / analysis) finishes
 */
async function runOptimize(entry: string, output: string, opts: OptimizeResolvedOptions) {
  const esbuild = await import("esbuild");

  const external = [...DEFAULT_EXTERNALS, ...opts.external];

  const platform = ESBUILD_PLATFORM_BY_TARGET[opts.target];
  const target = ESBUILD_TARGET_BY_OPTIMIZE_TARGET[opts.target];

  const inputSize = getFileSize(entry);

  if (opts.dryRun) {
    header("Dry Run - Bundle Analysis");
    info(`Entry:    ${entry}`);
    info(`Output:   ${output}`);
    info(`Target:   ${opts.target}`);
    info(`Minify:   ${opts.minify}`);
    info(`External: ${external.join(", ")}`);

    return;
  }

  const result = await esbuild.build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    treeShaking: true,
    format: "esm",
    platform,
    target,
    external,
    minify: opts.minify,
    metafile: opts.analyze,
    logLevel: "warning",
  });

  const outputSize = getFileSize(output);

  header("Build Complete");
  info(`Output: ${output}`);

  if (outputSize > 0) {
    console.log(`  Bundle size: ${formatSize(outputSize)}`);
    if (opts.minify && inputSize > 0 && outputSize < inputSize) {
      const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);
      console.log(`  Reduced by:  ${reduction}%`);
    }
    console.log();
  }

  if (opts.analyze && result.metafile) {
    const analysis = await esbuild.analyzeMetafile(result.metafile, {
      verbose: false,
    });
    header("Bundle Analysis");
    console.log(analysis);
  }
}

/**
 * Register the `elysia optimize` command on the given Commander program.
 * @param program - Root or parent Commander instance
 */
export function registerOptimizeCommand(program: Command): void {
  program
    .command("optimize [entry]")
    .description("Bundle and optimize your Elysia app with esbuild")
    .option("-o, --output <path>", "Output file path (default: dist/<entry>.js)")
    .option("--minify", "Enable minification", false)
    .option("--target <target>", "Build target: bun, node, browser", "node")
    .option("--analyze", "Show bundle analysis", false)
    .option("--dry-run", "Show what would be built without building", false)
    .option("-e, --external <package...>", "Additional external packages", [])
    .action(async (entry?: string, rawOpts: OptimizeCliOptionsRaw = {}) => {
      const resolvedEntry = entry ?? "src/index.ts";

      const filePath = exitOnError(resolveEntryPath(resolvedEntry));

      const optionsResult = parseOptimizeOptions(filePath, rawOpts);
      if (optionsResult.isErr()) {
        error(optionsResult.error.message);
        process.exit(1);
        return;
      }
      const options = optionsResult.value;

      exitOnError(
        await Result.tryPromise({
          try: async () => {
            await runOptimize(filePath, options.output, options);
            if (!options.dryRun) {
              success("Optimization complete");
            }
          },
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );
    });
}
