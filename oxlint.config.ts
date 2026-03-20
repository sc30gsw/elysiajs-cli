import { defineConfig } from "oxlint";

export default defineConfig({
  rules: {
    "no-unused-vars": "warn",
    "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: "error",
    "no-implicit-coercion": "warn",
  },
  ignorePatterns: ["dist/", "node_modules/", "test/fixtures/"],
});
