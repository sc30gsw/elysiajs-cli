/**
 * Detect if running in Bun environment
 * @returns `true` if running under Bun
 */
export function isBun() {
  return typeof Bun !== "undefined";
}
