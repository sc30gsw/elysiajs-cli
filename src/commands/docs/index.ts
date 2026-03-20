import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, type PathLike } from "fs";
import { homedir } from "os";
import { join } from "path";

import { Result } from "better-result";
import type { Command } from "commander";
import { isResponseError } from "up-fetch";

import { error, info, header, dim, exitOnError } from "~/utils/display.js";
import { docsFetcher } from "~/utils/fetcher.js";
import {
  DOC_CATEGORIES,
  TABLE_OF_CONTENTS_PATH,
  normalizeDocsRepoRelativePath,
  type DocsRepoRelativePath,
} from "~/types/docs-repo-path.js";

const CACHE_DIR = join(homedir(), ".cache", "elysia-cli", "docs");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Resolved CLI options for `elysia docs` */
export interface DocsResolvedOptions {
  cache: boolean;
}

/** Commander passes inverted `--no-cache` as `cache: false` when set */
export type DocsCliOptionsRaw = Partial<Pick<DocsResolvedOptions, "cache">>;

function parseDocsOptions(raw: DocsCliOptionsRaw): DocsResolvedOptions {
  const resolved = {
    cache: raw.cache !== false,
  } satisfies DocsResolvedOptions;
  return resolved;
}

/**
 * Get cache file path for a docs path
 */
function getCachePath(docsPath: DocsRepoRelativePath): string {
  const safe = docsPath.replace(/\//g, "__").replace(/\.md$/, "") + ".md";
  return join(CACHE_DIR, safe);
}

/**
 * Check if cached content is still valid
 */
function isCacheValid(cachePath: PathLike): boolean {
  if (!existsSync(cachePath)) return false;
  const stat = statSync(cachePath);
  return Date.now() - stat.mtimeMs < CACHE_TTL_MS;
}

/**
 * Read from cache
 */
function readCache(cachePath: PathLike): string {
  return readFileSync(cachePath, "utf-8");
}

/**
 * Write to cache
 */
function writeCache(cachePath: PathLike, content: string): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, content, "utf-8");
}

/**
 * Fetch a markdown file from the documentation repository
 */
async function fetchDoc(docPath: DocsRepoRelativePath): Promise<Result<string, Error>> {
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

/** Render markdown in the terminal via marked-terminal's marked v9+ extension. */
async function renderMarkdown(content: string): Promise<void> {
  const { marked } = await import("marked");
  const { markedTerminal } = await import("marked-terminal");

  marked.use(markedTerminal());
  const rendered = marked.parse(content);
  console.log(rendered);
}

/**
 * Display the table of contents
 */
async function showTableOfContents(): Promise<void> {
  const result = await fetchDoc(TABLE_OF_CONTENTS_PATH);
  await result.match({
    ok: async (content) => {
      await renderMarkdown(content);
    },
    err: async () => {
      // If table of contents doesn't exist, show a helpful message
      header("Elysia Documentation");
      console.log();
      info("Available documentation categories:");
      console.log();
      for (const category of DOC_CATEGORIES) {
        console.log(`  elysia docs ${category}/<page>`);
      }
      console.log();
      console.log("Examples:");
      console.log("  elysia docs essential/route");
      console.log("  elysia docs essential/handler");
      console.log("  elysia docs plugins/bearer");
    },
  });
}

export function registerDocsCommand(program: Command): void {
  program
    .command("docs [path]")
    .description("View Elysia documentation in your terminal")
    .option("--no-cache", "Skip cache and fetch fresh documentation")
    .action(async (docPathArg?: string, rawOpts: DocsCliOptionsRaw = {}) => {
      const opts = parseDocsOptions(rawOpts);

      if (!opts.cache) {
        if (docPathArg) {
          const normalizedPath = normalizeDocsRepoRelativePath(docPathArg);
          const cachePath = getCachePath(normalizedPath);
          if (existsSync(cachePath)) {
            const fs = await import("fs");
            fs.unlinkSync(cachePath);
          }
        }
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
