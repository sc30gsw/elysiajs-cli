import { type Result } from "better-result";
import chalk from "chalk";

const KNOWN_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const satisfies readonly string[];

type KnownHttpMethod = (typeof KNOWN_HTTP_METHODS)[number];

const SYMBOLS = {
  success: chalk.green("✓"),
  error: chalk.red("✗"),
  info: chalk.blue("ℹ"),
} as const satisfies Record<string, string>;

export function success(message: string): void {
  console.log(`${SYMBOLS.success} ${message}`);
}

export function error(message: string): void {
  console.error(`${SYMBOLS.error} ${message}`);
}

export function info(message: string): void {
  console.log(`${SYMBOLS.info} ${chalk.blue(message)}`);
}

export function dim(message: string): void {
  console.log(chalk.dim(message));
}

/**
 * Format HTTP method with color
 * @param method - HTTP method string (e.g., "GET", "POST")
 * @returns ANSI-colored method string padded to 7 characters
 */
export function formatMethod(method: string) {
  const colors = {
    GET: chalk.green,
    POST: chalk.blue,
    PUT: chalk.yellow,
    PATCH: chalk.cyan,
    DELETE: chalk.red,
    HEAD: chalk.magenta,
    OPTIONS: chalk.gray,
  } as const satisfies Record<KnownHttpMethod, (s: string) => string>;

  const colorFn = colors[method.toUpperCase() as KnownHttpMethod] ?? chalk.white;

  return colorFn(method.toUpperCase().padEnd(7));
}

/**
 * Format response status with color
 * @param status - HTTP response status code
 * @returns ANSI-colored status code string
 */
export function formatStatus(status: number) {
  if (status >= 200 && status < 300) {
    return chalk.green(String(status));
  }

  if (status >= 300 && status < 400) {
    return chalk.cyan(String(status));
  }

  if (status >= 400 && status < 500) {
    return chalk.yellow(String(status));
  }

  if (status >= 500) {
    return chalk.red(String(status));
  }

  return chalk.white(String(status));
}

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Human-readable size string (e.g., "1.5 KB", "2.3 MB")
 */
export function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Print a section header
 * @param title - Header title text
 */
export function header(title: string) {
  console.log();
  console.log(chalk.bold(chalk.cyan(title)));
  console.log(chalk.dim("─".repeat(Math.min(title.length + 2, 60))));
}

/**
 * Print elapsed time
 * @param ms - Elapsed time in milliseconds
 * @returns Human-readable time string (e.g., "42ms", "1.23s")
 */
export function elapsed(ms: number) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Extract value from a Result, or print error and exit with code 1
 * @param result - Result to unwrap
 * @returns The unwrapped value if successful
 * @throws Calls `process.exit(1)` on error after printing the error message
 */
export function exitOnError<T>(result: Result<T, { message: string }>): T {
  return result.match({
    ok: (value) => value,
    err: (e): never => {
      error(e.message);
      process.exit(1);
    },
  });
}
