import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { Result } from "better-result";
import { Command } from "commander";

import { registerDocsCommand } from "~/commands/docs/index.js";
import { registerOptimizeCommand } from "~/commands/optimize/index.js";
import { registerRequestCommand } from "~/commands/request/index.js";
import { registerSearchCommand } from "~/commands/search/index.js";
import { registerServeCommand } from "~/commands/serve/index.js";
import { isPackageJsonWithVersion } from "~/types/package-json.js";

/**
 * Read package version from package.json
 * @returns The version string from package.json, or "0.0.0" if not found
 */
function getVersion() {
  return Result.try(() => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgPath = join(__dirname, "..", "package.json");
    const raw: unknown = JSON.parse(readFileSync(pkgPath, "utf-8"));

    if (!isPackageJsonWithVersion(raw)) {
      throw new Error("package.json missing string `version`");
    }

    return raw.version;
  }).unwrapOr("0.0.0");
}

const program = new Command();

program
  .name("elysia")
  .description("Official CLI for ElysiaJS - Build fast, type-safe web APIs")
  .version(getVersion(), "-V, --version", "Output the current version");

registerDocsCommand(program);
registerSearchCommand(program);
registerRequestCommand(program);
registerServeCommand(program);
registerOptimizeCommand(program);

program.helpCommand("help [command]", "Display help for command");

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
