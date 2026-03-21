import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";

import { Result } from "better-result";
import type { Command } from "commander";
import { filter, map, pipe } from "remeda";

import type { DocsRepoRelativePath } from "~/types/docs-repo-path.js";
import {
  indexWithBrandedPaths,
  isSearchIndex,
  type DocEntry,
  type SearchIndex,
} from "~/types/search-index.js";
import { info, header, dim, exitOnError } from "~/utils/display.js";
import { docsFetcher, githubApiFetcher } from "~/utils/fetcher.js";

const DOCS_REPO_URL =
  "https://api.github.com/repos/elysiajs/documentation/git/trees/main?recursive=1";
const CACHE_DIR = join(homedir(), ".cache", "elysia-cli", "search");
const INDEX_FILE = join(CACHE_DIR, "index.json");
const INDEX_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Resolved options for `elysia search`
 */
interface SearchResolvedOptions {
  limit: number;
  pretty: boolean;
  rebuild: boolean;
}

type SearchCliOptionsRaw = Partial<
  Pick<SearchResolvedOptions, "pretty" | "rebuild"> & { limit?: string }
>;

/**
 * Normalize raw Commander options for `elysia search`.
 * @param raw - Partial CLI options (`limit` may be a string from the parser)
 * @returns Resolved limit, pretty-print flag, and rebuild flag
 */
function parseSearchOptions(raw: SearchCliOptionsRaw): SearchResolvedOptions {
  const limit = parseInt(raw.limit ?? "10", 10);

  return {
    limit: Number.isFinite(limit) ? limit : 10,
    pretty: raw.pretty ?? false,
    rebuild: raw.rebuild ?? false,
  } satisfies SearchResolvedOptions;
}

/**
 * Whether the on-disk search index cache can be used without rebuilding.
 * @returns `true` if the index file exists and is newer than {@link INDEX_TTL_MS}
 */
function isIndexValid(): boolean {
  if (!existsSync(INDEX_FILE)) return false;
  const stat = statSync(INDEX_FILE);
  return Date.now() - stat.mtimeMs < INDEX_TTL_MS;
}

/**
 * Fetch all markdown file paths from the documentation repo
 * @returns `Ok` with an array of repo-relative markdown paths, or `Err` on network failure
 */
async function fetchDocFilePaths(): Promise<Result<DocsRepoRelativePath[], Error>> {
  return Result.tryPromise({
    try: async () => {
      const tree = await githubApiFetcher(DOCS_REPO_URL);
      return pipe(
        tree.tree,
        filter(
          (item) =>
            item.type === "blob" && item.path.startsWith("docs/") && item.path.endsWith(".md"),
        ),
        map((item) => item.path.replace("docs/", "") as DocsRepoRelativePath),
      );
    },
    catch: (e) => (e instanceof Error ? e : new Error(String(e))),
  });
}

const FALLBACK_PATHS = [
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
] as const satisfies readonly string[];

const FALLBACK_DOCS_PATHS = FALLBACK_PATHS as unknown as readonly DocsRepoRelativePath[];

/**
 * Extract title from markdown content
 * @param content - Raw markdown string
 * @param path - Repo-relative path used as fallback title
 * @returns Title derived from the first heading, or a formatted filename
 */
function extractTitle(content: string, path: DocsRepoRelativePath) {
  const headingMatch = content.match(/^#+\s+(.+)$/m);

  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  const parts = path.split("/");
  const filename = parts[parts.length - 1]?.replace(".md", "") ?? path;

  return filename.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Whether a trimmed line is a reasonable start for a doc excerpt (not front matter, heading, or import).
 * @param trimmed - Single line of markdown, already trimmed
 */
function isExcerptCandidateLine(trimmed: string) {
  return (
    Boolean(trimmed) &&
    !trimmed.startsWith("#") &&
    !trimmed.startsWith("---") &&
    !trimmed.startsWith("import")
  );
}

/**
 * Remove common inline markdown from a single line for excerpt preview text.
 * @param line - One line of markdown
 */
function stripInlineMarkdownForExcerpt(line: string) {
  return line
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

/**
 * Truncate excerpt text to a maximum length, appending an ellipsis when clipped.
 * @param text - Plain-text line
 * @param maxLength - Character cap
 */
function truncateExcerptText(text: string, maxLength: number) {
  return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");
}

/**
 * Extract excerpt from markdown content (first non-heading paragraph)
 * @param content - Raw markdown string
 * @param maxLength - Maximum excerpt length in characters (default: 200)
 * @returns Plain-text excerpt string, or empty string if none found
 */
function extractExcerpt(content: string, maxLength = 200) {
  const lines = content.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    const trimmed = line.trim();

    if (!isExcerptCandidateLine(trimmed)) {
      continue;
    }

    const text = stripInlineMarkdownForExcerpt(trimmed);

    if (text.length <= 10) {
      continue;
    }

    return truncateExcerptText(text, maxLength);
  }

  return "";
}

/**
 * Strip markdown formatting for plain text search
 * @param content - Raw markdown string
 * @returns Plain-text version with formatting removed
 */
function stripMarkdown(content: string) {
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
 * @param onProgress - Optional progress callback invoked with (current, total)
 * @returns Fully built search index saved to disk
 */
async function buildIndex(onProgress?: (current: number, total: number) => void) {
  mkdirSync(CACHE_DIR, { recursive: true });

  info("Building search index from documentation...");

  const paths = (await fetchDocFilePaths()).unwrapOr([...FALLBACK_DOCS_PATHS]);

  const entries: DocEntry[] = [];
  const total = paths.length;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];

    if (!path) {
      continue;
    }

    onProgress?.(i + 1, total);

    const fetchResult = await Result.tryPromise(() => docsFetcher(path));

    if (fetchResult.isErr()) {
      continue;
    }

    const content = fetchResult.value;
    const title = extractTitle(content, path);
    const excerpt = extractExcerpt(content);
    const plainText = stripMarkdown(content);

    entries.push({ path, title, content: plainText, excerpt });
  }

  const index: SearchIndex = { entries, createdAt: Date.now() };
  writeFileSync(INDEX_FILE, JSON.stringify(index), "utf-8");

  return index;
}

/**
 * Read and validate the cached index from {@link INDEX_FILE}.
 * @returns Parsed index with branded paths, or `null` if missing or invalid
 */
function loadSearchIndexFromDisk() {
  const raw: unknown = JSON.parse(readFileSync(INDEX_FILE, "utf-8"));

  if (!isSearchIndex(raw)) {
    return null;
  }

  return indexWithBrandedPaths(raw);
}

/**
 * Load or build the search index
 * @param forceRebuild - If `true`, skip the cache and rebuild from scratch (default: false)
 * @returns Search index loaded from disk or freshly built
 */
async function getIndex(forceRebuild = false) {
  if (!forceRebuild && isIndexValid()) {
    const loaded = loadSearchIndexFromDisk();

    if (loaded) {
      return loaded;
    }
  }

  return buildIndex((current, total) => {
    process.stdout.write(`\r  Indexing... ${current}/${total}`);
  });
}

/**
 * Search the documentation with fuzzy matching
 * @param query - Search query string
 * @param limit - Maximum number of results to return
 * @param forceRebuild - If `true`, rebuild the search index before searching
 * @returns Array of Fuse.js search results with score information
 */
async function searchDocs(query: string, limit: number, forceRebuild: boolean) {
  const index = await getIndex(forceRebuild);
  const Fuse = (await import("fuse.js")).default;

  const fuse = new Fuse<DocEntry>(index.entries, {
    keys: [
      { name: "title", weight: 3 },
      { name: "path", weight: 2 },
      { name: "content", weight: 1 },
    ],
    includeScore: true,
    threshold: 0.4,
    minMatchCharLength: 2,
  });

  return fuse.search(query, { limit });
}

/**
 * Register the `elysia search` command on the given Commander program.
 * @param program - Root or parent Commander instance
 */
export function registerSearchCommand(program: Command) {
  program
    .command("search <query>")
    .description("Search Elysia documentation")
    .option("--pretty", "Format output for display (default: JSON)", false)
    .option("-l, --limit <n>", "Maximum number of results", "10")
    .option("--rebuild", "Rebuild the search index", false)
    .action(async (query: string, rawOpts: SearchCliOptionsRaw = {}) => {
      const opts = parseSearchOptions(rawOpts);

      const results = exitOnError(
        await Result.tryPromise({
          try: () => searchDocs(query, opts.limit, opts.rebuild),
          catch: (e) => (e instanceof Error ? e : new Error(String(e))),
        }),
      );

      if (results.length === 0) {
        info(`No results found for "${query}"`);
        return;
      }

      if (opts.pretty) {
        header(`Search Results for "${query}"`);

        for (let i = 0; i < results.length; i++) {
          const { item, score } = results[i]!;
          const relevance = Math.round((1 - (score ?? 0)) * 100);

          console.log(`  ${i + 1}. ${item.title}`);

          dim(`     Path: ${item.path}  (${relevance}% match)`);

          if (item.excerpt) {
            dim(`     ${item.excerpt}`);
          }

          dim(`     Run: elysia docs ${String(item.path).replace(".md", "")}`);
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
    });
}
