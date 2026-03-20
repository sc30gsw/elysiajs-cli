declare const docsRepoRelativePathBrand: unique symbol;

/**
 * Path segment under the documentation repo's `docs/` folder (forward slashes, `.md` suffix).
 * Not a local filesystem path — use Node `PathLike` for those.
 */
export type DocsRepoRelativePath = string & { readonly [docsRepoRelativePathBrand]: never };

export const TABLE_OF_CONTENTS_PATH = "table-of-content.md" as DocsRepoRelativePath;

export const DOC_CATEGORIES = [
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
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

/**
 * Normalize user input into a repo-relative docs path (always ends with `.md`).
 */
export function normalizeDocsRepoRelativePath(raw: string): DocsRepoRelativePath {
  const trimmed = raw.trim().replace(/^\/+/, "");
  const withMd = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
  return withMd as DocsRepoRelativePath;
}
