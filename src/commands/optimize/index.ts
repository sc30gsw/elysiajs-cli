import { statSync, type PathLike } from "fs";
import { resolve, dirname, basename, extname, join } from "path";

import { Result } from "better-result";
import type { Command } from "commander";

import { error, info, success, header, formatSize, exitOnError } from "~/utils/display.js";
import { resolveEntryPath } from "~/utils/loader.js";

export const OPTIMIZE_TARGETS = ["bun", "node", "browser"] as const;

export type OptimizeTarget = (typeof OPTIMIZE_TARGETS)[number];

/** Resolved options for `elysia optimize` */
export interface OptimizeResolvedOptions {
  output: string;
  minify: boolean;
  target: OptimizeTarget;
  analyze: boolean;
  dryRun: boolean;
  external: string[];
}

export type OptimizeCliOptionsRaw = Partial<
  Omit<OptimizeResolvedOptions, "target" | "output" | "dryRun"> & {
    target?: string;
    output?: string;
    dryRun?: boolean;
  }
>;

function isOptimizeTarget(s: string): s is OptimizeTarget {
  return (OPTIMIZE_TARGETS as readonly string[]).includes(s);
}

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

/**
 * Default external packages (Elysia's peer dependencies and runtime-provided packages)
 */
const DEFAULT_EXTERNALS = ["@sinclair/typebox", "file-type", "bun", "bun:*"];

/**
 * Build output path from entry and options
 */
function resolveOutputPath(entry: string, outputOpt?: string): string {
  if (outputOpt) return resolve(process.cwd(), outputOpt);

  const dir = dirname(entry);
  const base = basename(entry, extname(entry));
  return join(dir, "..", "dist", `${base}.js`);
}

/**
 * Get file size safely
 */
function getFileSize(filePath: PathLike): number {
  return Result.try(() => statSync(filePath).size).unwrapOr(0);
}

/**
 * Run esbuild optimization
 */
async function runOptimize(
  entry: string,
  output: string,
  opts: OptimizeResolvedOptions,
): Promise<void> {
  const esbuild = await import("esbuild");

  const external = [...DEFAULT_EXTERNALS, ...opts.external];

  const platform = opts.target === "browser" ? "browser" : "node";
  const target = opts.target === "bun" ? "bun1.0" : opts.target === "browser" ? "es2022" : "node20";

  const inputSize = getFileSize(entry);

  if (opts.dryRun) {
    header("Dry Run - Bundle Analysis");
    console.log();
    info(`Entry:    ${entry}`);
    info(`Output:   ${output}`);
    info(`Target:   ${opts.target}`);
    info(`Minify:   ${opts.minify}`);
    info(`External: ${external.join(", ")}`);
    console.log();
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
  console.log();
  info(`Output: ${output}`);
  console.log();

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
