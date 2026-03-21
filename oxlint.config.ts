import { defineConfig } from "oxlint";

export default defineConfig({
  rules: {
    "no-unused-vars": "warn",
    // CLI のユーザー向け出力は console が正しい経路
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: "error",
    "no-implicit-coercion": "warn",
  },
  ignorePatterns: ["dist/", "node_modules/", "test/fixtures/"],
});
