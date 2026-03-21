import { Result } from "better-result";
import chalk from "chalk";
import type { Command } from "commander";

import { header, error, info, dim, exitOnError } from "~/utils/display.js";
import { resolveEntryPath, loadApp } from "~/utils/loader.js";
import { formatRoutes, extractRoutes } from "~/utils/routes.js";
import { isBun } from "~/utils/runtime.js";

interface ServeResolvedOptions {
  port: number;
  showRoutes: boolean;
  use: string[];
  external: string[];
}

type ServeCliOptionsRaw = Partial<Omit<ServeResolvedOptions, "port">> &
  Partial<Record<"port", string>>;

/**
 * Normalize raw Commander options into concrete values for the dev server.
 * @param raw - Partial CLI options (port may be a string from the parser)
 * @returns Resolved port, route display flag, and bundle externals
 */
function parseServeOptions(raw: ServeCliOptionsRaw) {
  const port = parseInt(raw.port ?? "3000", 10);

  return {
    port: Number.isFinite(port) ? port : 3000,
    showRoutes: raw.showRoutes ?? false,
    use: raw.use ?? [],
    external: raw.external ?? [],
  } as const satisfies ServeResolvedOptions;
}

/**
 * Run `cleanup` once on SIGINT/SIGTERM, then exit with code 0.
 * Ignores duplicate signals while shutdown is in progress.
 * @param cleanup - Async-safe teardown (e.g. kill child process, close watcher)
 */
function registerProcessExitHandlers(cleanup: () => void | Promise<void>) {
  let shuttingDown = false;
  const onSignal = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void Promise.resolve(cleanup()).finally(() => process.exit(0));
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

/**
 * Start dev server with Bun's native hot reload
 * @param entry - Entry file path for the Elysia app
 * @param opts - Resolved serve options (port, etc.)
 */
async function servWithBun(entry: string, opts: ServeResolvedOptions) {
  const args = ["bun", "--hot", entry];

  if (opts.port) {
    args.push("--port", String(opts.port));
  }

  info(`Starting with Bun hot reload...`);
  dim(`  ${args.join(" ")}`);

  const proc = Bun.spawn(args, {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PORT: String(opts.port),
    },
  });

  registerProcessExitHandlers(() => {
    proc.kill();
  });

  await proc.exited;
}

/**
 * Start dev server with Node.js (esbuild + chokidar)
 * @param entry - Entry file path for the Elysia app
 * @param opts - Resolved serve options (port, external packages, etc.)
 */
async function serveWithNode(entry: string, opts: ServeResolvedOptions) {
  const { spawn } = await import("child_process");
  const chokidar = await import("chokidar");
  const os = await import("os");
  const path = await import("path");
  const fs = await import("fs/promises");
  const esbuild = await import("esbuild");

  const outDir = path.join(os.tmpdir(), "elysia-cli", "serve");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "app.mjs");

  info("Starting with Node.js watch mode...");
  dim(`  Entry: ${entry}`);

  let currentProcess: ReturnType<typeof spawn> | null = null;

  /** Bundle the Elysia entry into a temporary ESM file for Node. */
  async function transpile() {
    await esbuild.build({
      entryPoints: [entry],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node20",
      external: ["elysia", "@sinclair/typebox", ...opts.external],
      sourcemap: "inline",
      logLevel: "silent",
    });
  }

  /** Re-transpile if needed and spawn (or respawn) the Node child process. */
  async function start() {
    if (currentProcess) {
      currentProcess.kill();
      currentProcess = null;
    }

    const transpileResult = await Result.tryPromise({
      try: () => transpile(),
      catch: (e) => (e instanceof Error ? e : new Error(String(e))),
    });

    if (transpileResult.isErr()) {
      error(`Transpile error: ${transpileResult.error.message}`);
      return;
    }

    currentProcess = spawn("node", [outFile], {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: String(opts.port),
      },
    });

    currentProcess.on("error", (err) => {
      error(`Process error: ${err.message}`);
    });
  }

  await start();

  const watcher = chokidar.watch(path.dirname(entry), {
    ignoreInitial: true,
    ignored: ["**/node_modules/**", "**/dist/**"],
  });

  watcher.on("change", async (changedPath) => {
    info(`Changed: ${path.relative(process.cwd(), changedPath)}`);
    await start();
  });

  registerProcessExitHandlers(async () => {
    await watcher.close();
    if (currentProcess) currentProcess.kill();
  });

  await new Promise(() => {});
}

/**
 * Show routes from an Elysia app before serving
 * @param entry - Entry file path for the Elysia app
 */
async function showAppRoutes(entry: string) {
  const result = await loadApp(entry);
  result.match({
    ok: ({ app }) => {
      const routes = extractRoutes(app);
      header("Routes");
      console.log(formatRoutes(routes));
    },
    err: (e) => {
      error(`Could not load app to show routes: ${e.message}`);
    },
  });
}

/**
 * Register the `elysia serve` command on the given Commander program.
 * @param program - Root or parent Commander instance
 */
export function registerServeCommand(program: Command) {
  program
    .command("serve [entry]")
    .description("Start a development server with hot reload")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("--show-routes", "Display registered routes on startup", false)
    .option("--use <middleware...>", "Inject middleware (path to middleware file)", [])
    .option("-e, --external <package...>", "External packages to exclude from bundle", [])
    .action(async (entry?: string, rawOpts: ServeCliOptionsRaw = {}) => {
      const resolvedEntry = entry ?? "src/index.ts";
      const options = parseServeOptions(rawOpts);

      const filePath = exitOnError(resolveEntryPath(resolvedEntry));

      console.log(chalk.bold(chalk.magenta("  Elysia")) + chalk.dim(" dev server"));
      info(`Entry:  ${filePath}`);
      info(`Port:   ${options.port}`);

      if (options.showRoutes) {
        await showAppRoutes(filePath);
      }

      exitOnError(
        await Result.tryPromise({
          try: () => (isBun() ? servWithBun(filePath, options) : serveWithNode(filePath, options)),
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );
    });
}
