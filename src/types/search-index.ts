import type { DocsRepoRelativePath } from "~/types/docs-repo-path.js";

export interface DocEntry {
  path: DocsRepoRelativePath;
  title: string;
  content: string;
  excerpt: string;
}

export interface SearchIndex {
  entries: DocEntry[];
  createdAt: number;
}

function isDocEntry(value: unknown): value is DocEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const o = value as Record<string, unknown>;

  return (
    typeof o.path === "string" &&
    typeof o.title === "string" &&
    typeof o.content === "string" &&
    typeof o.excerpt === "string"
  );
}

export function isSearchIndex(value: unknown): value is SearchIndex {
  if (!value || typeof value !== "object") {
    return false;
  }

  const o = value as Record<string, unknown>;

  if (typeof o.createdAt !== "number" || !Array.isArray(o.entries)) {
    return false;
  }

  return o.entries.every(isDocEntry);
}

/**
 * Narrow JSON-parsed paths to branded repo-relative paths (validated as strings)
 * @param index - Search index with plain string paths
 * @returns Search index with branded `DocsRepoRelativePath` paths
 */
export function indexWithBrandedPaths(index: SearchIndex) {
  return {
    createdAt: index.createdAt,
    entries: index.entries.map((e) => ({
      ...e,
      path: e.path as DocsRepoRelativePath,
    })),
  };
}
