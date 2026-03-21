import type { PathLike } from "fs";
import { writeFile } from "fs/promises";

import { Result } from "better-result";
import chalk from "chalk";
import type { Command } from "commander";

import { formatMethod, formatStatus, elapsed, header, error, info, dim } from "~/utils/display.js";
import { loadApp } from "~/utils/loader.js";

interface RequestResolvedOptions {
  method: string;
  header: string[];
  body: string | undefined;
  verbose: boolean;
  watch: boolean;
  json: boolean;
  output: string | undefined;
}

type RequestCliOptionsRaw = Partial<RequestResolvedOptions>;

/**
 * Normalize partial CLI options into concrete values for a single request run.
 * @param raw - Options as received from Commander (all fields optional)
 * @returns Fully resolved request options with defaults applied
 */
function parseRequestOptions(raw: RequestCliOptionsRaw) {
  return {
    method: raw.method ?? "GET",
    header: raw.header ?? [],
    body: raw.body ?? undefined,
    verbose: raw.verbose ?? false,
    watch: raw.watch ?? false,
    json: raw.json ?? false,
    output: raw.output ?? undefined,
  } as const satisfies RequestResolvedOptions;
}

/**
 * Parse header strings into Headers object
 * @param headers - Array of header strings in "Name: Value" format
 * @returns `Ok` with a populated Headers object, or `Err` if any header is malformed
 */
function parseHeaders(headers: string[]) {
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
 * @param url - Fully qualified URL for the request
 * @param headers - Parsed request headers
 * @param opts - Resolved request options (method, body, etc.)
 * @returns Constructed Request object ready for dispatch
 */
function buildRequest(url: string, headers: Headers, opts: RequestResolvedOptions) {
  if (opts.body && !headers.has("content-type")) {
    const body = opts.body;

    Result.try(() => JSON.parse(body)).match({
      ok: () => {
        headers.set("content-type", "application/json");
      },
      err: () => {
        headers.set("content-type", "text/plain");
      },
    });
  }

  return new Request(url, {
    method: opts.method.toUpperCase(),
    headers,
    ...(opts.body !== undefined ? { body: opts.body } : {}),
  });
}

/**
 * Format response body for display
 * @param response - HTTP response to read body from
 * @param forceJson - If `true`, attempt to pretty-print as JSON regardless of content type
 * @returns Formatted body string
 */
async function formatBody(response: Response, forceJson: boolean) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (forceJson || contentType.includes("application/json")) {
    return Result.try(() => JSON.parse(text)).match({
      ok: (parsed) => JSON.stringify(parsed, null, 2),
      err: () => text,
    });
  }

  return text;
}

/**
 * Print request line, headers, and body (pretty JSON when parseable) in verbose mode.
 * @param url - Full request URL
 * @param method - HTTP method label
 * @param headers - Headers after parsing (including inferred `Content-Type` from {@link buildRequest})
 * @param body - Optional raw body string
 */
function logVerboseRequest(
  url: string,
  method: string,
  headers: Headers,
  body: string | undefined,
) {
  header("Request");
  console.log(`  ${formatMethod(method)}  ${url}`);

  for (const [name, value] of headers.entries()) {
    dim(`  ${name}: ${value}`);
  }

  if (!body) {
    return;
  }

  info("Body:");
  Result.try(() => JSON.parse(body)).match({
    ok: (parsed) => {
      console.log(JSON.stringify(parsed, null, 2));
    },
    err: () => {
      console.log(body);
    },
  });
}

/**
 * Print status line and response headers in verbose mode.
 * @param response - Response from `app.handle`
 * @param status - Colored status code string from {@link formatStatus}
 * @param time - Dimmed elapsed time label
 */
function logVerboseResponse(response: Response, status: string, time: string) {
  header("Response");
  console.log(`  ${status} ${response.statusText}  ${time}`);

  for (const [name, value] of response.headers.entries()) {
    dim(`  ${name}: ${value}`);
  }
}

/**
 * Execute a request against an Elysia app
 * @param entry - Entry file path for the Elysia app
 * @param urlOrPath - URL or path to request (e.g., "/api/users" or "http://localhost/...")
 * @param opts - Resolved request options
 * @returns `Ok` on success, or `Err` with a descriptive error
 */
async function executeRequest(entry: string, urlOrPath: string, opts: RequestResolvedOptions) {
  return Result.gen(async function* () {
    const { app } = yield* Result.await(loadApp(entry));
    const headers = yield* parseHeaders(opts.header);

    const url = urlOrPath.startsWith("http")
      ? urlOrPath
      : `http://localhost${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;

    const request = buildRequest(url, headers, opts);

    if (opts.verbose) {
      logVerboseRequest(url, opts.method, headers, opts.body);
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
      logVerboseResponse(response, status, time);
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

/**
 * Register the `elysia request` / `elysia req` command on the given Commander program.
 * @param program - Root or parent Commander instance
 */
export function registerRequestCommand(program: Command) {
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
          info("File changed, re-running request...");
          const r = await executeRequest(resolvedFile, resolvedUrl, options);
          if (r.isErr()) {
            error(r.error.message);
          }
        });
      }
    });
}
