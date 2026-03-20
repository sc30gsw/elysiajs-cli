export interface GitHubGitTreeItem {
  path: string;
  type: string;
}

export interface GitHubGitTreeResponse {
  tree: GitHubGitTreeItem[];
}

export function isGitHubGitTreeResponse(value: unknown): value is GitHubGitTreeResponse {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (!Array.isArray(o.tree)) return false;
  return o.tree.every((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return typeof row.path === "string" && typeof row.type === "string";
  });
}
