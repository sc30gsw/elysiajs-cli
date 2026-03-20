import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [".claude/", "dist/", "node_modules/", "test/dist/"],
  sortImports: {
    partitionByComment: true,
  },
  sortPackageJson: {
    sortScripts: true,
  },
});
