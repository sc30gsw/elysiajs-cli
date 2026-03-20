import { Result } from "better-result";
import chalk from "chalk";
import type { Command } from "commander";

import { header, error, info, dim, exitOnError } from "~/utils/display.js";
import { resolveEntryPath, loadApp } from "~/utils/loader.js";
import { formatRoutes, extractRoutes } from "~/utils/routes.js";
import { isBun } from "~/utils/runtime.js";

interface ServeOptions {
  port: number;
  showRoutes: boolean;
  use: string[];
  external: string[];
}

/**
 * Start dev server with Bun's native hot reload
 */
async function servWithBun(entry: string, opts: ServeOptions): Promise<void> {
  const args = ["bun", "--hot", entry];

  if (opts.port) {
    args.push("--port", String(opts.port));
  }

  info(`Starting with Bun hot reload...`);
  dim(`  ${args.join(" ")}`);
  console.log();

  const proc = Bun.spawn(args, {
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PORT: String(opts.port),
    },
  });

  // Handle SIGINT/SIGTERM for clean shutdown
  process.on("SIGINT", () => {
    proc.kill();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    proc.kill();
    process.exit(0);
  });

  await proc.exited;
}

/**
 * Start dev server with Node.js (esbuild + chokidar)
 */
async function serveWithNode(entry: string, opts: ServeOptions): Promise<void> {
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
  console.log();

  let currentProcess: ReturnType<typeof spawn> | null = null;

  async function transpile(): Promise<void> {
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

  async function start(): Promise<void> {
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

  // Handle SIGINT/SIGTERM for clean shutdown
  process.on("SIGINT", async () => {
    await watcher.close();
    if (currentProcess) currentProcess.kill();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await watcher.close();
    if (currentProcess) currentProcess.kill();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}

/**
 * Show routes from an Elysia app before serving
 */
async function showAppRoutes(entry: string): Promise<void> {
  const result = await loadApp(entry);
  result.match({
    ok: ({ app }) => {
      const routes = extractRoutes(app);
      header("Routes");
      console.log(formatRoutes(routes));
      console.log();
    },
    err: (e) => {
      error(`Could not load app to show routes: ${e.message}`);
    },
  });
}

export function registerServeCommand(program: Command): void {
  program
    .command("serve [entry]")
    .description("Start a development server with hot reload")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("--show-routes", "Display registered routes on startup", false)
    .option("--use <middleware...>", "Inject middleware (path to middleware file)", [])
    .option("-e, --external <package...>", "External packages to exclude from bundle", [])
    .action(async (entry?: string, opts: Partial<ServeOptions & { port: string }> = {}) => {
      const resolvedEntry = entry ?? "src/index.ts";
      const port = parseInt(opts.port ?? "3000", 10);
      const options: ServeOptions = {
        port,
        showRoutes: opts.showRoutes ?? false,
        use: opts.use ?? [],
        external: opts.external ?? [],
      };

      const filePath = exitOnError(resolveEntryPath(resolvedEntry));

      console.log();
      console.log(chalk.bold(chalk.magenta("  Elysia")) + chalk.dim(" dev server"));
      console.log();
      info(`Entry:  ${filePath}`);
      info(`Port:   ${port}`);
      console.log();

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
