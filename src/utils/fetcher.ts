import { up } from "up-fetch";

import { isGitHubGitTreeResponse } from "~/types/github-api.js";

const DOCS_BASE_URL = "https://raw.githubusercontent.com/elysiajs/documentation/main/docs";

export const docsFetcher = up(fetch, () => ({
  baseUrl: DOCS_BASE_URL,
  parseResponse: (res: Response) => res.text(),
}));

export const githubApiFetcher = up(fetch, () => ({
  headers: {
    Accept: "application/vnd.github.v3+json",
  },
  parseResponse: async (res: Response) => {
    const json: unknown = await res.json();

    if (!isGitHubGitTreeResponse(json)) {
      throw new Error("Invalid GitHub git/trees API response shape");
    }

    return json;
  },
}));
