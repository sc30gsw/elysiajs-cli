import chalk from "chalk";

/**
 * Display utilities for terminal output
 */

export const symbols = {
  success: chalk.green("✓"),
  error: chalk.red("✗"),
  warning: chalk.yellow("⚠"),
  info: chalk.blue("ℹ"),
  arrow: chalk.gray("→"),
  bullet: chalk.gray("•"),
} as const;

export function success(message: string): void {
  console.log(`${symbols.success} ${message}`);
}

export function error(message: string): void {
  console.error(`${symbols.error} ${chalk.red(message)}`);
}

export function warning(message: string): void {
  console.warn(`${symbols.warning} ${chalk.yellow(message)}`);
}

export function info(message: string): void {
  console.log(`${symbols.info} ${chalk.blue(message)}`);
}

export function dim(message: string): void {
  console.log(chalk.dim(message));
}

/**
 * Format HTTP method with color
 */
export function formatMethod(method: string): string {
  const colors: Record<string, (s: string) => string> = {
    GET: chalk.green,
    POST: chalk.blue,
    PUT: chalk.yellow,
    PATCH: chalk.cyan,
    DELETE: chalk.red,
    HEAD: chalk.magenta,
    OPTIONS: chalk.gray,
  };
  const colorFn = colors[method.toUpperCase()] ?? chalk.white;
  return colorFn(method.toUpperCase().padEnd(7));
}

/**
 * Format response status with color
 */
export function formatStatus(status: number): string {
  if (status >= 200 && status < 300) return chalk.green(String(status));
  if (status >= 300 && status < 400) return chalk.cyan(String(status));
  if (status >= 400 && status < 500) return chalk.yellow(String(status));
  if (status >= 500) return chalk.red(String(status));
  return chalk.white(String(status));
}

/**
 * Format file size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Print a section header
 */
export function header(title: string): void {
  console.log();
  console.log(chalk.bold(chalk.cyan(title)));
  console.log(chalk.dim("─".repeat(Math.min(title.length + 2, 60))));
}

/**
 * Print a table
 */
export function table(rows: string[][]): void {
  if (rows.length === 0) return;

  const colWidths = rows[0]!.map((_, colIdx) =>
    Math.max(...rows.map((row) => (row[colIdx] ?? "").length)),
  );

  for (const row of rows) {
    const cells = row.map((cell, i) => cell.padEnd(colWidths[i] ?? 0));
    console.log(`  ${cells.join("  ")}`);
  }
}

/**
 * Print elapsed time
 */
export function elapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print a banner for the CLI
 */
export function banner(): void {
  console.log(chalk.bold(chalk.magenta("\n  Elysia CLI\n")));
}
