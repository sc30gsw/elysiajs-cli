# ElysiaJS CLI — Project Patterns

Patterns specific to this codebase. Follow these for consistency.

## Command Registration

Each command lives in `src/commands/<name>/index.ts` and exports a single register function:

```typescript
// src/commands/docs/index.ts
import type { Command } from "commander";

export function registerDocsCommand(program: Command): void {
  program
    .command("docs [path]")
    .description("View Elysia documentation in your terminal")
    .option("--no-cache", "Skip cache and fetch fresh documentation")
    .action(async (pathArg?: string, rawOpts: DocsCliOptionsRaw = {}) => {
      const opts = parseDocsOptions(rawOpts);
      // command logic
    });
}
```

Register in `src/cli.ts`:

```typescript
import { registerDocsCommand } from "~/commands/docs/index.js";

const program = new Command();
registerDocsCommand(program);
program.parse();
```

## Options Pattern: Raw → Resolved

Commander passes raw options (partial, un-defaulted). Always parse them:

```typescript
// Raw: what commander passes — partial, strings not yet coerced
type SearchCliOptionsRaw = Partial<{
  limit: string; // commander passes strings for options
  pretty: boolean;
}>;

// Resolved: fully defaulted and typed
interface SearchResolvedOptions {
  limit: number;
  pretty: boolean;
}

function parseSearchOptions(raw: SearchCliOptionsRaw): SearchResolvedOptions {
  return {
    limit: raw.limit !== undefined ? Number(raw.limit) : 10,
    pretty: raw.pretty === true,
  };
}
```

## Result Type Error Handling

Use `better-result` for operations that can fail. Chain with `Result.gen` for sequential async operations:

```typescript
import { Result } from "better-result";
import { isResponseError } from "up-fetch";

// Async fallible operation
async function fetchDoc(path: DocsRepoRelativePath): Promise<Result<string, Error>> {
  return Result.tryPromise({
    try: async () => {
      const content = await docsFetcher(path);
      writeCache(getCachePath(path), content);
      return content;
    },
    catch: (e) => {
      if (isResponseError(e) && e.status === 404) {
        return new Error(`Documentation not found: "${path}"`);
      }
      return e instanceof Error ? e : new Error(String(e));
    },
  });
}

// Sequential async operations
async function processCommand(path: string): Promise<Result<void, Error>> {
  return Result.gen(async function* () {
    const normalized = yield* normalizeDocsRepoRelativePath(path);
    const content = yield* fetchDoc(normalized);
    await renderMarkdown(content);
  });
}

// In command action: exit with error message on failure
const content = exitOnError(await fetchDoc(normalized));
```

## Terminal Output

All terminal output goes through `~/utils/display.ts`. Never use `console.log` directly in command logic:

```typescript
import { success, error, info, dim, header, elapsed, exitOnError } from "~/utils/display.js";
import { formatMethod, formatStatus, formatSize } from "~/utils/display.js";

// Status messages
success("Server started on port 3000"); // ✓ green
error("Failed to load entry file"); // ✗ red (stderr)
info("Fetching documentation..."); // ℹ blue
dim("(from cache)"); // gray/dim

// Section header
header("Routes"); // bold cyan + separator line

// HTTP request/response formatting
console.log(`${formatMethod("GET")} /api/users ${formatStatus(200)} ${elapsed(42)}`);

// Size formatting
console.log(`Bundle: ${formatSize(102400)}`);

// Exit on error
const app = exitOnError(await loadApp(entryFile));
```

## Caching Pattern

Documentation and search indexes are cached to `~/.cache/elysia-cli/` with a 24-hour TTL:

```typescript
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CACHE_DIR = join(homedir(), ".cache", "elysia-cli", "docs");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isCacheValid(cachePath: string): boolean {
  if (!existsSync(cachePath)) return false;
  return Date.now() - statSync(cachePath).mtimeMs < CACHE_TTL_MS;
}

function readCache(cachePath: string): string {
  return readFileSync(cachePath, "utf-8");
}

function writeCache(cachePath: string, content: string): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, content, "utf-8");
}
```

## Runtime Detection

Use `isBun()` from `~/utils/runtime.ts` to branch on Bun vs. Node.js:

```typescript
import { isBun } from "~/utils/runtime.js";

if (isBun()) {
  // Use Bun-native APIs: Bun.serve, bun --hot, etc.
  await startBunServer(entry, port);
} else {
  // Fallback: esbuild transpile + chokidar watch
  await startNodeServer(entry, port);
}
```

## Brand Types

Use brand types (opaque types) for domain-specific string values to prevent mixing up path types:

```typescript
// Definition
type DocsRepoRelativePath = string & { readonly __brand: "DocsRepoRelativePath" };

// Constructor/normalizer
function normalizeDocsRepoRelativePath(input: string): DocsRepoRelativePath {
  let path = input.trim();
  if (!path.endsWith(".md")) path = `${path}.md`;
  return path as DocsRepoRelativePath;
}

// Usage — compiler enforces the type
const path = normalizeDocsRepoRelativePath(userInput);
await fetchDoc(path); // Only accepts DocsRepoRelativePath, not plain string
```

## Type Guard Pattern

```typescript
// Type guard with unknown input
function isPackageJsonWithVersion(value: unknown): value is { version: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof (value as Record<string, unknown>).version === "string"
  );
}
```
