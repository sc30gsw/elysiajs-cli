# Update Codemaps

Analyze the codebase structure and generate token-lean architecture documentation.

## Step 1: Scan Project Structure

1. Identify the project structure (CLI tool with commands and utilities)
2. Find all source directories: `src/commands/`, `src/utils/`, `src/types/`, `src/constants/`
3. Map entry points: `src/cli.ts`
4. Identify test structure: `test/commands/`, `test/integration/`, `test/fixtures/`

## Step 2: Generate Codemaps

Create or update codemaps in `docs/CODEMAPS/` (or `.reports/codemaps/`):

| File | Contents |
|------|----------|
| `architecture.md` | High-level CLI architecture, command flow, data flow |
| `commands.md` | CLI commands, options, and their implementations |
| `utilities.md` | Utility modules and their responsibilities |
| `dependencies.md` | External packages and their purposes |

### Codemap Format

Each codemap should be token-lean — optimized for AI context consumption:

```markdown
# CLI Architecture

## Entry Point
src/cli.ts → creates Commander program → registers all commands → program.parse()

## Commands
elysia docs [path]     → registerDocsCommand   → src/commands/docs/index.ts
elysia search <query>  → registerSearchCommand  → src/commands/search/index.ts
elysia req [entry]     → registerRequestCommand → src/commands/request/index.ts
elysia serve [entry]   → registerServeCommand   → src/commands/serve/index.ts
elysia optimize        → registerOptimizeCommand → src/commands/optimize/index.ts

## Utilities
src/utils/display.ts   → terminal output helpers (success, error, info, dim, header)
src/utils/fetcher.ts   → GitHub API HTTP client (up-fetch based)
src/utils/loader.ts    → Elysia app entry resolution and dynamic import
src/utils/routes.ts    → route extraction from Elysia app instance
src/utils/runtime.ts   → Bun vs Node.js detection (isBun())

## Key Patterns
- Options: XxxCliOptionsRaw (Partial) → parseXxxOptions() → XxxResolvedOptions
- Errors: better-result Result<T, Error> → exitOnError() for CLI exit
- Cache: ~/.cache/elysia-cli/ with 24h TTL
```

## Step 3: Diff Detection

1. If previous codemaps exist, calculate the diff percentage
2. If changes > 30%, show the diff and request user approval before overwriting
3. If changes <= 30%, update in place

## Step 4: Add Metadata

Add a freshness header to each codemap:

```markdown
<!-- Generated: 2026-03-21 | Files scanned: 18 | Token estimate: ~600 -->
```

## Step 5: Save Analysis Report

Write a summary to `.reports/codemap-diff.txt`:
- Files added/removed/modified since last scan
- New commands or utilities detected
- Architecture changes (new patterns, removed dependencies)
- Staleness warnings for docs not updated in 90+ days

## Tips

- Focus on **high-level structure**, not implementation details
- Prefer **file paths and function signatures** over full code blocks
- Keep each codemap under **1000 tokens** for efficient context loading
- Use ASCII diagrams for data flow instead of verbose descriptions
- Run after adding new commands or significant refactoring sessions
