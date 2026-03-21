declare const docsRepoRelativePathBrand: unique symbol;

export type DocsRepoRelativePath = string & { readonly [docsRepoRelativePathBrand]: never };

/**
 * Normalize user input into a repo-relative docs path (always ends with `.md`)
 * @param raw - Raw user input path (e.g., "essential/route")
 * @returns Normalized repo-relative path with `.md` suffix
 */
export function normalizeDocsRepoRelativePath(raw: string) {
  const trimmed = raw.trim().replace(/^\/+/, "");
  const withMd = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;

  return withMd as DocsRepoRelativePath;
}
