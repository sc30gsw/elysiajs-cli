import { up } from "up-fetch";

import { isGitHubGitTreeResponse, type GitHubGitTreeResponse } from "~/types/github-api.js";

const DOCS_BASE_URL = "https://raw.githubusercontent.com/elysiajs/documentation/main/docs";

/**
 * Fetcher for GitHub raw documentation content (returns text)
 */
export const docsFetcher = up(fetch, () => ({
  baseUrl: DOCS_BASE_URL,
  parseResponse: (res: Response) => res.text(),
}));

/**
 * Fetcher for GitHub API (returns JSON — validated git/trees payload)
 */
export const githubApiFetcher = up(fetch, () => ({
  headers: {
    Accept: "application/vnd.github.v3+json",
  },
  parseResponse: async (res: Response): Promise<GitHubGitTreeResponse> => {
    const json: unknown = await res.json();
    if (!isGitHubGitTreeResponse(json)) {
      throw new Error("Invalid GitHub git/trees API response shape");
    }
    return json;
  },
}));

export type { GitHubGitTreeResponse };
