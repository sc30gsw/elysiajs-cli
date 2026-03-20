import { up } from "up-fetch";

const DOCS_BASE_URL = "https://raw.githubusercontent.com/elysiajs/documentation/main/docs";

/**
 * Fetcher for GitHub raw documentation content (returns text)
 */
export const docsFetcher = up(fetch, () => ({
  baseUrl: DOCS_BASE_URL,
  parseResponse: (res: Response) => res.text(),
}));

/**
 * Fetcher for GitHub API (returns JSON)
 */
export const githubApiFetcher = up(fetch, () => ({
  headers: {
    Accept: "application/vnd.github.v3+json",
  },
}));
