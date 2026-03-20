import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { Command } from "commander";

import { error, info, header, dim } from "~/utils/display.js";

const DOCS_BASE_URL = "https://raw.githubusercontent.com/elysiajs/documentation/main/docs";
const CACHE_DIR = join(homedir(), ".cache", "elysia-cli", "docs");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const TABLE_OF_CONTENTS_PATH = "table-of-content.md";

/**
 * Docs categories available in the documentation
 */
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
] as const satisfies string[];

/**
 * Get cache file path for a docs path
 */
function getCachePath(docsPath: string): string {
  const safe = docsPath.replace(/\//g, "__").replace(/\.md$/, "") + ".md";
  return join(CACHE_DIR, safe);
}

/**
 * Check if cached content is still valid
 */
function isCacheValid(cachePath: string): boolean {
  if (!existsSync(cachePath)) return false;
  const stat = statSync(cachePath);
  return Date.now() - stat.mtimeMs < CACHE_TTL_MS;
}

/**
 * Read from cache
 */
function readCache(cachePath: string): string {
  return readFileSync(cachePath, "utf-8");
}

/**
 * Write to cache
 */
function writeCache(cachePath: string, content: string): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, content, "utf-8");
}

/**
 * Fetch a markdown file from the documentation repository
 */
async function fetchDoc(docPath: string): Promise<string> {
  // Normalize path - add .md extension if missing
  const normalizedPath = docPath.endsWith(".md") ? docPath : `${docPath}.md`;
  const url = `${DOCS_BASE_URL}/${normalizedPath}`;
  const cachePath = getCachePath(normalizedPath);

  if (isCacheValid(cachePath)) {
    dim("(from cache)");
    return readCache(cachePath);
  }

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Documentation not found: "${docPath}"\n\n` +
          `Available categories: ${DOC_CATEGORIES.join(", ")}\n` +
          `Example: elysia docs essential/route`,
      );
    }
    throw new Error(`Failed to fetch documentation: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  writeCache(cachePath, content);
  return content;
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
  try {
    const content = await fetchDoc(TABLE_OF_CONTENTS_PATH);
    await renderMarkdown(content);
  } catch {
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
  }
}

export function registerDocsCommand(program: Command): void {
  program
    .command("docs [path]")
    .description("View Elysia documentation in your terminal")
    .option("--no-cache", "Skip cache and fetch fresh documentation")
    .action(async (docPath?: string, opts: { cache?: boolean } = {}) => {
      if (!opts.cache) {
        // Clear cache for this path
        if (docPath) {
          const normalizedPath = docPath.endsWith(".md") ? docPath : `${docPath}.md`;
          const cachePath = getCachePath(normalizedPath);
          if (existsSync(cachePath)) {
            const fs = await import("fs");
            fs.unlinkSync(cachePath);
          }
        }
      }

      try {
        if (!docPath) {
          await showTableOfContents();
          return;
        }

        const content = await fetchDoc(docPath);
        await renderMarkdown(content);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
