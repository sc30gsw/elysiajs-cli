import type { PathLike } from "fs";
import { writeFile } from "fs/promises";

import { Result } from "better-result";
import chalk from "chalk";
import type { Command } from "commander";

import { formatMethod, formatStatus, elapsed, header, error, info, dim } from "~/utils/display.js";
import { loadApp } from "~/utils/loader.js";

/** Resolved options for `elysia req` */
export interface RequestResolvedOptions {
  method: string;
  header: string[];
  body: string | undefined;
  verbose: boolean;
  watch: boolean;
  json: boolean;
  output: string | undefined;
}

export type RequestCliOptionsRaw = Partial<RequestResolvedOptions>;

function parseRequestOptions(raw: RequestCliOptionsRaw): RequestResolvedOptions {
  return {
    method: raw.method ?? "GET",
    header: raw.header ?? [],
    body: raw.body ?? undefined,
    verbose: raw.verbose ?? false,
    watch: raw.watch ?? false,
    json: raw.json ?? false,
    output: raw.output ?? undefined,
  } satisfies RequestResolvedOptions;
}

/**
 * Parse header strings into Headers object
 */
function parseHeaders(headers: string[]): Result<Headers, Error> {
  const result = new Headers();
  for (const h of headers) {
    const colonIdx = h.indexOf(":");
    if (colonIdx === -1) {
      return Result.err(new Error(`Invalid header format: "${h}". Expected "Name: Value"`));
    }
    const name = h.slice(0, colonIdx).trim();
    const value = h.slice(colonIdx + 1).trim();
    result.set(name, value);
  }
  return Result.ok(result);
}

/**
 * Build a Request object from parsed headers and options
 */
function buildRequest(url: string, headers: Headers, opts: RequestResolvedOptions): Request {
  // Set Content-Type for body if not set
  if (opts.body && !headers.has("content-type")) {
    try {
      JSON.parse(opts.body);
      headers.set("content-type", "application/json");
    } catch {
      headers.set("content-type", "text/plain");
    }
  }

  return new Request(url, {
    method: opts.method.toUpperCase(),
    headers,
    ...(opts.body !== undefined ? { body: opts.body } : {}),
  });
}

/**
 * Format response body for display
 */
async function formatBody(response: Response, forceJson: boolean): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (forceJson || contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  }

  return text;
}

/**
 * Execute a request against an Elysia app
 */
async function executeRequest(
  entry: string,
  urlOrPath: string,
  opts: RequestResolvedOptions,
): Promise<Result<void, Error>> {
  return Result.gen(async function* () {
    const { app } = yield* Result.await(loadApp(entry));
    const headers = yield* parseHeaders(opts.header);

    // Build the URL - if path is given without host, use localhost
    const url = urlOrPath.startsWith("http")
      ? urlOrPath
      : `http://localhost${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;

    const request = buildRequest(url, headers, opts);

    if (opts.verbose) {
      header("Request");
      console.log(`  ${formatMethod(opts.method)}  ${url}`);

      for (const [name, value] of headers.entries()) {
        dim(`  ${name}: ${value}`);
      }

      if (opts.body) {
        console.log();
        info("Body:");
        try {
          console.log(JSON.stringify(JSON.parse(opts.body), null, 2));
        } catch {
          console.log(opts.body);
        }
      }
      console.log();
    }

    const start = Date.now();
    const response = yield* Result.await(
      Result.tryPromise({
        try: () => app.handle(request),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      }),
    );
    const ms = Date.now() - start;

    const status = formatStatus(response.status);
    const time = chalk.dim(`${elapsed(ms)}`);

    if (opts.verbose) {
      header("Response");
      console.log(`  ${status} ${response.statusText}  ${time}`);

      for (const [name, value] of response.headers.entries()) {
        dim(`  ${name}: ${value}`);
      }
      console.log();
    } else {
      console.log(`${status} ${time}`);
    }

    const body = await formatBody(response, opts.json);

    if (opts.output) {
      const outPath: PathLike = opts.output;
      yield* Result.await(
        Result.tryPromise({
          try: () => writeFile(outPath, body, "utf-8"),
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );
      info(`Response written to: ${opts.output}`);
    } else {
      console.log(body);
    }

    return Result.ok();
  });
}

export function registerRequestCommand(program: Command): void {
  program
    .command("request [file] [url]")
    .alias("req")
    .description("Make an HTTP request to your Elysia app")
    .option("-m, --method <method>", "HTTP method", "GET")
    .option("-H, --header <header...>", 'Request headers (format: "Name: Value")', [])
    .option("-b, --body <body>", "Request body")
    .option("-v, --verbose", "Show request/response details", false)
    .option("--watch", "Watch for file changes and re-run", false)
    .option("--json", "Force JSON output formatting", false)
    .option("-o, --output <file>", "Write response body to file")
    .action(async (file?: string, url?: string, rawOpts: RequestCliOptionsRaw = {}) => {
      const resolvedFile = file ?? "src/index.ts";
      const resolvedUrl = url ?? "/";
      const options = parseRequestOptions(rawOpts);

      const result = await executeRequest(resolvedFile, resolvedUrl, options);
      if (result.isErr()) {
        error(result.error.message);
        process.exit(1);
      }

      if (options.watch) {
        const chokidar = await import("chokidar");
        const watcher = chokidar.watch(resolvedFile, { ignoreInitial: true });

        info(`Watching ${resolvedFile} for changes...`);

        watcher.on("change", async () => {
          console.log();
          info("File changed, re-running request...");
          const r = await executeRequest(resolvedFile, resolvedUrl, options);
          if (r.isErr()) {
            error(r.error.message);
          }
        });
      }
    });
}
