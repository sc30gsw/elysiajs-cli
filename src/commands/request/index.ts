import chalk from "chalk";
import type { Command } from "commander";

import { formatMethod, formatStatus, elapsed, header, error, info, dim } from "~/utils/display.js";
import { loadApp } from "~/utils/loader.js";

interface RequestOptions {
  method: string;
  header: string[];
  body: string | undefined;
  verbose: boolean;
  watch: boolean;
  json: boolean;
  output: string | undefined;
}

/**
 * Parse header strings into Headers object
 */
function parseHeaders(headers: string[]): Headers {
  const result = new Headers();
  for (const h of headers) {
    const colonIdx = h.indexOf(":");
    if (colonIdx === -1) {
      throw new Error(`Invalid header format: "${h}". Expected "Name: Value"`);
    }
    const name = h.slice(0, colonIdx).trim();
    const value = h.slice(colonIdx + 1).trim();
    result.set(name, value);
  }
  return result;
}

/**
 * Build a Request object from CLI options
 */
function buildRequest(url: string, opts: RequestOptions): Request {
  const headers = parseHeaders(opts.header);

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
  opts: RequestOptions,
): Promise<void> {
  const { app } = await loadApp(entry);

  // Build the URL - if path is given without host, use localhost
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `http://localhost${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;

  const request = buildRequest(url, opts);

  if (opts.verbose) {
    header("Request");
    console.log(`  ${formatMethod(opts.method)}  ${url}`);

    const headers = parseHeaders(opts.header);
    if (headers.entries) {
      for (const [name, value] of headers.entries()) {
        dim(`  ${name}: ${value}`);
      }
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
  const response = await app.handle(request);
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
    const { writeFile } = await import("fs/promises");
    await writeFile(opts.output, body, "utf-8");
    info(`Response written to: ${opts.output}`);
  } else {
    console.log(body);
  }
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
    .action(async (file?: string, url?: string, opts: Partial<RequestOptions> = {}) => {
      const resolvedFile = file ?? "src/index.ts";
      const resolvedUrl = url ?? "/";
      const options: RequestOptions = {
        method: opts.method ?? "GET",
        header: opts.header ?? [],
        body: opts.body ?? undefined,
        verbose: opts.verbose ?? false,
        watch: opts.watch ?? false,
        json: opts.json ?? false,
        output: opts.output ?? undefined,
      };

      try {
        await executeRequest(resolvedFile, resolvedUrl, options);

        if (options.watch) {
          const chokidar = await import("chokidar");
          const watcher = chokidar.watch(resolvedFile, { ignoreInitial: true });

          info(`Watching ${resolvedFile} for changes...`);

          watcher.on("change", async () => {
            console.log();
            info("File changed, re-running request...");
            try {
              await executeRequest(resolvedFile, resolvedUrl, options);
            } catch (err) {
              error(err instanceof Error ? err.message : String(err));
            }
          });
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
