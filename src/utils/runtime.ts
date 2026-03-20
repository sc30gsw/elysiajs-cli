import { Result } from "better-result";

/**
 * Runtime detection utilities for Bun/Node.js
 */

export type Runtime = "bun" | "node";

/**
 * Detect if running in Bun environment
 */
export function isBun(): boolean {
  return typeof Bun !== "undefined";
}

/**
 * Get current runtime
 */
export function getRuntime(): Runtime {
  return isBun() ? "bun" : "node";
}

/**
 * Get runtime version string
 */
export function getRuntimeVersion(): string {
  if (isBun()) {
    return `Bun ${Bun.version}`;
  }
  return `Node.js ${process.version}`;
}

/**
 * Check if a command is available in PATH
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  if (isBun()) {
    const result = await Bun.spawn(["which", command], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;
    return result === 0;
  }

  const { execSync } = await import("child_process");
  return Result.try(() => {
    execSync(`which ${command}`, { stdio: "ignore" });
  }).isOk();
}

/**
 * Get executable for running TypeScript files
 */
export function getTsRunner(): string {
  if (isBun()) return "bun";
  return "tsx";
}
