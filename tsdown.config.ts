import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  /** Emit `dist/cli.js` to match package.json `bin` (not `.mjs`). */
  fixedExtension: false,
  clean: true,
  dts: true,
  treeshake: true,
  alias: {
    "~": srcDir,
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
