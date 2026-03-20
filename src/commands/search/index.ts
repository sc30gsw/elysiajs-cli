import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import type { Command } from "commander";

import { error, info, header, dim } from "~/utils/display.js";

const DOCS_REPO_URL =
  "https://api.github.com/repos/elysiajs/documentation/git/trees/main?recursive=1";
const DOCS_BASE_URL = "https://raw.githubusercontent.com/elysiajs/documentation/main/docs";
const CACHE_DIR = join(homedir(), ".cache", "elysia-cli", "search");
const INDEX_FILE = join(CACHE_DIR, "index.json");
const INDEX_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DocEntry {
  path: string;
  title: string;
  content: string;
  excerpt: string;
}

interface SearchIndex {
  entries: DocEntry[];
  createdAt: number;
}

/**
 * Check if the search index needs to be rebuilt
 */
function isIndexValid(): boolean {
  if (!existsSync(INDEX_FILE)) return false;
  const stat = statSync(INDEX_FILE);
  return Date.now() - stat.mtimeMs < INDEX_TTL_MS;
}

/**
 * Fetch all markdown file paths from the documentation repo
 */
async function fetchDocFilePaths(): Promise<string[]> {
  const response = await fetch(DOCS_REPO_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch doc tree: ${response.status}`);
  }

  const tree = (await response.json()) as { tree: Array<{ path: string; type: string }> };
  return tree.tree
    .filter(
      (item) => item.type === "blob" && item.path.startsWith("docs/") && item.path.endsWith(".md"),
    )
    .map((item) => item.path.replace("docs/", ""));
}

/**
 * Extract title from markdown content
 */
function extractTitle(content: string, path: string): string {
  const headingMatch = content.match(/^#+\s+(.+)$/m);
  if (headingMatch?.[1]) return headingMatch[1].trim();

  // Fall back to path-based title
  const parts = path.split("/");
  const filename = parts[parts.length - 1]?.replace(".md", "") ?? path;
  return filename.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract excerpt from markdown content (first non-heading paragraph)
 */
function extractExcerpt(content: string, maxLength = 200): string {
  const lines = content.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("---") &&
      !trimmed.startsWith("import")
    ) {
      // Strip markdown formatting
      const text = trimmed
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\[(.+?)\]\(.+?\)/g, "$1");

      if (text.length > 10) {
        return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");
      }
    }
  }

  return "";
}

/**
 * Strip markdown formatting for plain text search
 */
function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^---[\s\S]+?---/m, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Build the search index from documentation files
 */
async function buildIndex(
  onProgress?: (current: number, total: number) => void,
): Promise<SearchIndex> {
  mkdirSync(CACHE_DIR, { recursive: true });

  info("Building search index from documentation...");

  let paths: string[];
  try {
    paths = await fetchDocFilePaths();
  } catch {
    // If we can't fetch the file list, use a predefined set of common docs
    paths = [
      "at-a-glance.md",
      "table-of-content.md",
      "essential/route.md",
      "essential/handler.md",
      "essential/life-cycle.md",
      "essential/plugin.md",
      "essential/schema.md",
      "essential/context.md",
      "patterns/cookie.md",
      "patterns/websocket.md",
      "patterns/macro.md",
      "plugins/bearer.md",
      "plugins/cors.md",
      "plugins/swagger.md",
    ];
  }

  const entries: DocEntry[] = [];
  const total = paths.length;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    if (!path) continue;

    onProgress?.(i + 1, total);

    try {
      const url = `${DOCS_BASE_URL}/${path}`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const content = await response.text();
      const title = extractTitle(content, path);
      const excerpt = extractExcerpt(content);
      const plainText = stripMarkdown(content);

      entries.push({ path, title, content: plainText, excerpt });
    } catch {
      // Skip failed fetches
    }
  }

  const index: SearchIndex = { entries, createdAt: Date.now() };
  writeFileSync(INDEX_FILE, JSON.stringify(index), "utf-8");

  return index;
}

/**
 * Load or build the search index
 */
async function getIndex(forceRebuild = false): Promise<SearchIndex> {
  if (!forceRebuild && isIndexValid()) {
    return JSON.parse(readFileSync(INDEX_FILE, "utf-8")) as SearchIndex;
  }
  return buildIndex((current, total) => {
    process.stdout.write(`\r  Indexing... ${current}/${total}`);
  });
}

/**
 * Search the documentation with fuzzy matching
 */
async function searchDocs(
  query: string,
  limit: number,
  forceRebuild: boolean,
): Promise<Array<{ item: DocEntry; score: number }>> {
  const index = await getIndex(forceRebuild);
  const Fuse = (await import("fuse.js")).default;

  const fuse = new Fuse(index.entries, {
    keys: [
      { name: "title", weight: 3 },
      { name: "path", weight: 2 },
      { name: "content", weight: 1 },
    ],
    includeScore: true,
    threshold: 0.4,
    minMatchCharLength: 2,
  });

  const results = fuse.search(query, { limit });
  return results as Array<{ item: DocEntry; score: number }>;
}

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search Elysia documentation")
    .option("--pretty", "Format output for display (default: JSON)", false)
    .option("-l, --limit <n>", "Maximum number of results", "10")
    .option("--rebuild", "Rebuild the search index", false)
    .action(
      async (query: string, opts: { pretty?: boolean; limit?: string; rebuild?: boolean }) => {
        const limit = parseInt(opts.limit ?? "10", 10);
        const pretty = opts.pretty ?? false;
        const rebuild = opts.rebuild ?? false;

        try {
          const results = await searchDocs(query, limit, rebuild);

          if (results.length === 0) {
            info(`No results found for "${query}"`);
            return;
          }

          if (pretty) {
            console.log();
            header(`Search Results for "${query}"`);
            console.log();

            for (let i = 0; i < results.length; i++) {
              const { item, score } = results[i]!;
              const relevance = Math.round((1 - (score ?? 0)) * 100);
              console.log(`  ${i + 1}. ${item.title}`);
              dim(`     Path: ${item.path}  (${relevance}% match)`);
              if (item.excerpt) {
                dim(`     ${item.excerpt}`);
              }
              dim(`     Run: elysia docs ${item.path.replace(".md", "")}`);
              console.log();
            }
          } else {
            const output = results.map(({ item, score }) => ({
              path: item.path,
              title: item.title,
              excerpt: item.excerpt,
              score: Math.round((1 - (score ?? 0)) * 100),
            }));
            console.log(JSON.stringify(output, null, 2));
          }
        } catch (err) {
          error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      },
    );
}
