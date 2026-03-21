import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  unlinkSync,
  type PathLike,
} from "fs";
import { homedir } from "os";
import { join } from "path";

import { Result } from "better-result";
import type { Command } from "commander";
import { isResponseError } from "up-fetch";

import {
  normalizeDocsRepoRelativePath,
  type DocsRepoRelativePath,
} from "~/types/docs-repo-path.js";
import { info, header, dim, exitOnError } from "~/utils/display.js";
import { docsFetcher } from "~/utils/fetcher.js";

const TABLE_OF_CONTENTS_PATH = "table-of-content.md" as DocsRepoRelativePath;
const CACHE_DIR = join(homedir(), ".cache", "elysia-cli", "docs");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DOC_CATEGORIES = [
  "blog",
  "components",
  "eden",
  "essential",
  "integrations",
  "internal",
  "migrate",
  "patterns",
  "playground",
  "plugins",
  "tutorial",
] as const satisfies readonly string[];

interface DocsResolvedOptions {
  cache: boolean;
}

type DocsCliOptionsRaw = Partial<Pick<DocsResolvedOptions, "cache">>;

/**
 * Derive cache behavior from Commander options (`--no-cache` sets {@link DocsResolvedOptions.cache} to `false`).
 * @param raw - Partial CLI options
 * @returns Resolved options (defaults to using cache when unspecified)
 */
function parseDocsOptions(raw: DocsCliOptionsRaw) {
  const resolved = {
    cache: raw.cache !== false,
  } as const satisfies DocsResolvedOptions;

  return resolved;
}

/**
 * Get cache file path for a docs path
 * @param docsPath - Repo-relative docs path
 * @returns Absolute path to the local cache file
 */
function getCachePath(docsPath: DocsRepoRelativePath) {
  const safe = docsPath.replace(/\//g, "__").replace(/\.md$/, "") + ".md";
  return join(CACHE_DIR, safe);
}

/**
 * Check if cached content is still valid
 * @param cachePath - Path to the cache file
 * @returns `true` if the cache file exists and is within the 24-hour TTL
 */
function isCacheValid(cachePath: PathLike) {
  if (!existsSync(cachePath)) {
    return false;
  }

  const stat = statSync(cachePath);

  return Date.now() - stat.mtimeMs < CACHE_TTL_MS;
}

/**
 * Read from cache
 * @param cachePath - Path to the cache file
 * @returns UTF-8 content of the cache file
 */
function readCache(cachePath: PathLike) {
  return readFileSync(cachePath, "utf-8");
}

/**
 * Write to cache
 * @param cachePath - Path to the cache file
 * @param content - Content to write
 */
function writeCache(cachePath: PathLike, content: string) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, content, "utf-8");
}

/**
 * Remove the on-disk cache for a user-supplied docs path (e.g. when `--no-cache` is set)
 * @param docPathArg - Raw path argument from the CLI
 */
function clearDocsCacheForUserPath(docPathArg: string) {
  const normalizedPath = normalizeDocsRepoRelativePath(docPathArg);
  const cachePath = getCachePath(normalizedPath);
  if (!existsSync(cachePath)) return;
  unlinkSync(cachePath);
}

/**
 * Fetch a markdown file from the documentation repository
 * @param docPath - Repo-relative path to the documentation file
 * @returns `Ok` with the markdown content, or `Err` with a descriptive error
 */
async function fetchDoc(docPath: DocsRepoRelativePath) {
  const cachePath = getCachePath(docPath);

  if (isCacheValid(cachePath)) {
    dim("(from cache)");
    return Result.ok(readCache(cachePath));
  }

  return Result.tryPromise({
    try: async () => {
      const content = await docsFetcher(docPath);
      writeCache(cachePath, content);
      return content;
    },
    catch: (e) => {
      if (isResponseError(e) && e.status === 404) {
        return new Error(
          `Documentation not found: "${docPath}"\n\n` +
            `Available categories: ${DOC_CATEGORIES.join(", ")}\n` +
            `Example: elysia docs essential/route`,
        );
      }

      if (isResponseError(e)) {
        return new Error(`Failed to fetch documentation: ${e.status} ${e.message}`);
      }

      return e instanceof Error ? e : new Error(String(e));
    },
  });
}

/**
 * Render markdown in the terminal via marked-terminal's marked v9+ extension.
 * @param content - Raw markdown string to render
 * @returns Resolves after printing rendered HTML to stdout
 */
async function renderMarkdown(content: string) {
  const { marked } = await import("marked");
  const { markedTerminal } = await import("marked-terminal");

  marked.use(markedTerminal());
  const rendered = marked.parse(content);
  console.log(rendered);
}

/**
 * Display the documentation table of contents, or a static category list if the TOC page cannot be fetched.
 * @returns Resolves after rendering or printing the fallback help text
 */
async function showTableOfContents() {
  const result = await fetchDoc(TABLE_OF_CONTENTS_PATH);
  await result.match({
    ok: async (content) => {
      await renderMarkdown(content);
    },
    err: async () => {
      // If table of contents doesn't exist, show a helpful message
      header("Elysia Documentation");
      info("Available documentation categories:");

      for (const category of DOC_CATEGORIES) {
        console.log(`  elysia docs ${category}/<page>`);
      }

      console.log("Examples:");
      console.log("  elysia docs essential/route");
      console.log("  elysia docs essential/handler");
      console.log("  elysia docs plugins/bearer");
    },
  });
}

/**
 * Register the `elysia docs` command on the given Commander program.
 * @param program - Root or parent Commander instance
 */
export function registerDocsCommand(program: Command): void {
  program
    .command("docs [path]")
    .description("View Elysia documentation in your terminal")
    .option("--no-cache", "Skip cache and fetch fresh documentation")
    .action(async (docPathArg?: string, rawOpts: DocsCliOptionsRaw = {}) => {
      const opts = parseDocsOptions(rawOpts);

      if (!opts.cache && docPathArg) {
        clearDocsCacheForUserPath(docPathArg);
      }

      if (!docPathArg) {
        await showTableOfContents();
        return;
      }

      const normalized = normalizeDocsRepoRelativePath(docPathArg);
      const content = exitOnError(await fetchDoc(normalized));
      await renderMarkdown(content);
    });
}
