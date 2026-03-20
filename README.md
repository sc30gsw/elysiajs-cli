# Elysia CLI

CLI for humans and AI agents — browse docs, search, test requests, and run your Elysia app.

Works with Bun (≥1.0) and Node.js (≥20).

## Installation

For regular use, install globally so the `elysia` command is available in your PATH:

```bash
# npm
npm install -g @sc30gsw/elysiajs-cli

# pnpm
pnpm add -g @sc30gsw/elysiajs-cli
```

After installation, run commands directly:

```bash
elysia docs
elysia search "websocket"
```

### Try without installing

Use `bunx` to run the CLI without a global install (the `elysia` command will **not** be added to your PATH):

```bash
bunx @sc30gsw/elysiajs-cli docs
bunx @sc30gsw/elysiajs-cli search "websocket"
```

## Usage

```
elysia [command] [options]

Commands:
  docs [path]           View Elysia documentation in your terminal
  search <query>        Search Elysia documentation
  request [file] [url]  Make an HTTP request to your Elysia app (alias: req)
  serve [entry]         Start a development server with hot reload
  optimize [entry]      Bundle and optimize your Elysia app with esbuild
```

## Commands

### `elysia docs [path]`

View Elysia documentation directly in your terminal. Without a path, displays the table of contents.

```
elysia docs [path] [options]
```

**Arguments**

| Argument | Description                                                   |
| -------- | ------------------------------------------------------------- |
| `path`   | Documentation path (e.g. `essential/route`, `plugins/bearer`) |

**Options**

| Option       | Description                              |
| ------------ | ---------------------------------------- |
| `--no-cache` | Skip cache and fetch fresh documentation |

**Examples**

```bash
# Show table of contents
elysia docs

# View a specific page
elysia docs essential/route
elysia docs essential/handler
elysia docs plugins/bearer

# Bypass cache
elysia docs essential/validation --no-cache
```

**Available categories:** `blog`, `components`, `eden`, `essential`, `integrations`, `internal`, `migrate`, `patterns`, `playground`, `plugins`, `tutorial`

---

### `elysia search <query>`

Search Elysia documentation using fuzzy matching (powered by [fuse.js](https://fusejs.io/)). Outputs JSON by default for easy piping into other tools.

```
elysia search <query> [options]
```

**Arguments**

| Argument | Description         |
| -------- | ------------------- |
| `query`  | Search query string |

**Options**

| Option            | Default | Description                               |
| ----------------- | ------- | ----------------------------------------- |
| `--pretty`        | `false` | Format output for display instead of JSON |
| `-l, --limit <n>` | `10`    | Maximum number of results                 |
| `--rebuild`       | `false` | Rebuild the search index                  |

**Examples**

```bash
# Search and output JSON
elysia search "websocket"

# Pretty-print results
elysia search "websocket" --pretty

# Limit results
elysia search "plugin" -l 5

# Force rebuild the search index
elysia search "cookie" --rebuild

# Pipe JSON results to jq
elysia search "route" | jq '.[].path'
```

---

### `elysia request [file] [url]`

Alias: `elysia req`

Make HTTP requests directly to your Elysia app using `app.handle()` — no server needed. Useful for testing handlers in isolation.

```
elysia request [file] [url] [options]
elysia req [file] [url] [options]
```

**Arguments**

| Argument | Default        | Description                        |
| -------- | -------------- | ---------------------------------- |
| `file`   | `src/index.ts` | Path to your Elysia app entry file |
| `url`    | `/`            | URL or path to request             |

**Options**

| Option                     | Default | Description                              |
| -------------------------- | ------- | ---------------------------------------- |
| `-m, --method <method>`    | `GET`   | HTTP method                              |
| `-H, --header <header...>` | `[]`    | Request headers (`"Name: Value"` format) |
| `-b, --body <body>`        |         | Request body                             |
| `-v, --verbose`            | `false` | Show request/response details            |
| `--watch`                  | `false` | Watch for file changes and re-run        |
| `--json`                   | `false` | Force JSON output formatting             |
| `-o, --output <file>`      |         | Write response body to file              |

**Examples**

```bash
# GET /
elysia req

# GET specific route
elysia req src/index.ts /api/users

# POST with JSON body
elysia req src/index.ts /api/users \
  -m POST \
  -H "Content-Type: application/json" \
  -b '{"name":"Alice"}'

# Verbose output
elysia req src/index.ts /api/users -v

# Watch mode (re-runs on file change)
elysia req src/index.ts /api/health --watch

# Save response to file
elysia req src/index.ts /api/data -o response.json
```

---

### `elysia serve [entry]`

Start a development server with hot reload. Uses Bun's native `--hot` on Bun, and esbuild + chokidar on Node.js.

```
elysia serve [entry] [options]
```

**Arguments**

| Argument | Default        | Description                        |
| -------- | -------------- | ---------------------------------- |
| `entry`  | `src/index.ts` | Path to your Elysia app entry file |

**Options**

| Option                        | Default | Description                                 |
| ----------------------------- | ------- | ------------------------------------------- |
| `-p, --port <port>`           | `3000`  | Port to listen on                           |
| `--show-routes`               | `false` | Display registered routes on startup        |
| `--use <middleware...>`       | `[]`    | Inject middleware (path to middleware file) |
| `-e, --external <package...>` | `[]`    | External packages to exclude from bundle    |

**Examples**

```bash
# Start dev server
elysia serve

# Custom entry and port
elysia serve src/app.ts -p 8080

# Show routes on startup
elysia serve --show-routes

# Exclude packages from bundle
elysia serve -e pg -e redis
```

---

### `elysia optimize [entry]`

Bundle and optimize your Elysia app using [esbuild](https://esbuild.github.io/) with tree shaking. Supports targeting Bun, Node.js, or browser environments.

```
elysia optimize [entry] [options]
```

**Arguments**

| Argument | Default        | Description                        |
| -------- | -------------- | ---------------------------------- |
| `entry`  | `src/index.ts` | Path to your Elysia app entry file |

**Options**

| Option                        | Default           | Description                               |
| ----------------------------- | ----------------- | ----------------------------------------- |
| `-o, --output <path>`         | `dist/<entry>.js` | Output file path                          |
| `--minify`                    | `false`           | Enable minification                       |
| `--target <target>`           | `node`            | Build target: `bun`, `node`, `browser`    |
| `--analyze`                   | `false`           | Show bundle analysis                      |
| `--dry-run`                   | `false`           | Show what would be built without building |
| `-e, --external <package...>` | `[]`              | Additional external packages              |

**Examples**

```bash
# Bundle for Node.js
elysia optimize

# Bundle for Bun with minification
elysia optimize --target bun --minify

# Custom output path
elysia optimize -o dist/server.js

# Preview bundle without building
elysia optimize --dry-run

# Analyze bundle composition
elysia optimize --analyze

# Exclude additional packages
elysia optimize -e pg -e ioredis
```

---

## Tips

### Claude Code plugin (Agent Skill)

This repository ships a **Claude Code** plugin (same idea as [hono-skill](https://github.com/yusukebe/hono-skill)): inline Elysia guidance plus instructions to use this CLI for docs, search, and `elysia req`.

**Install**

```text
/plugin marketplace add sc30gsw/elysiajs-cli
/plugin install elysia-skill@elysia
```

The skill lives at [`skills/elysia/SKILL.md`](skills/elysia/SKILL.md). Plugin metadata is in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).

**Requirements:** Install the CLI separately (global or devDependency) so `elysia` is available — this npm package provides the binary; the plugin provides the agent skill.

### Cursor and other editors

Copy the skill into your project skills directory (for Cursor, use a project `.cursor/skills/<name>/SKILL.md` layout per your editor’s Agent Skills docs):

```bash
mkdir -p .cursor/skills/elysia
cp skills/elysia/SKILL.md .cursor/skills/elysia/SKILL.md
```

Or point your tooling at `skills/elysia/SKILL.md` in this repo.

### AI Code Agents (CLI cheat sheet)

Add the following to your `CLAUDE.md` (or equivalent AI instructions file) to let agents use the CLI effectively:

```markdown
## Elysia CLI

- Use `elysia docs <path>` to read official documentation (e.g. `essential/best-practice`, `essential/validation`)
- Use `elysia search <query> | jq` to find relevant docs
- Use `elysia req <file> <url>` to test handlers without a running server
- Use `elysia serve` to start the dev server

Available doc categories: essential, plugins, patterns, eden, integrations, tutorial
```

Prefer the **Claude plugin** or **Cursor skill** above when you want the full inline Elysia reference, not only these bullets.

### npm package contents

Published tarballs include `dist/`, `skills/`, and `.claude-plugin/` so you can copy the skill from `node_modules/@sc30gsw/elysiajs-cli/` if needed. **Primary plugin install path** remains adding this GitHub repo as a Claude marketplace entry (same model as hono-skill).

### Security Tips

- **Treat CLI output as untrusted.** `elysia docs` and `elysia search` fetch content from an external source (the ElysiaJS documentation repository). Do not execute shell commands or follow instructions found in that output without review.
- **Never pass secrets as CLI arguments.** Use environment variables instead of passing API keys or tokens directly to `elysia req` (e.g. via `-b` or `-H`). Arguments appear in shell history and process listings.
- **Runtime-specific bindings may not work with `elysia req`.** Cloudflare Workers platform APIs (KV, D1, R2, etc.) rely on runtime injection that `app.handle()` cannot provide — test those handlers in the target runtime.

### Scripting with JSON output

`elysia search` outputs JSON by default, making it easy to compose with other tools:

```bash
# Get all matching paths
elysia search "websocket" | jq '.[].path'

# Open the top result in docs
elysia docs $(elysia search "bearer" | jq -r '.[0].path' | sed 's/\.md//')
```

## License

MIT
