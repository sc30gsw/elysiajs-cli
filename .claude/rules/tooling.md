# Toolchain

Critical reference: which tools this project actually uses. Do NOT suggest alternatives.

## Runtime

| Tool | Version | Notes |
|------|---------|-------|
| **Bun** | >= 1.0 | Primary runtime — recommended |
| **Node.js** | >= 20 | Supported fallback |

**Package management:** `bun install`, `bun add`, `bun remove` — NOT npm/yarn/pnpm

## Build

| Tool | Command | Output |
|------|---------|--------|
| **tsdown** | `bun run build` | `dist/` (ESM) |
| | `bun run dev` | Watch mode |

## Testing

| Tool | Command | Notes |
|------|---------|-------|
| **Vitest** | `bun run test` | Unit + integration |
| **@vitest/coverage-v8** | `bun run test:coverage` | Coverage reports |
| | `bun run test:watch` | Watch mode |
| | `bun run test:build` | Build + test (CI) |

**Use `vi.fn()` and `vi.mock()` — NOT `jest.fn()` / `jest.mock()`**

## Lint & Format

| Tool | Command | Notes |
|------|---------|-------|
| **oxlint** | `bun run oxlint:check` | Linter |
| **oxfmt** | `bun run oxfmt:check` | Formatter |
| | `bun run oxc:check` | Both (CI) |
| | `bun run oxc:fix` | Both with auto-fix |

**NOT Prettier. NOT ESLint. NOT Biome.**

## Git Hooks

**Lefthook** — NOT Husky.

- `pre-commit` (parallel): oxlint + oxfmt on staged files
- `pre-push`: `bun run oxc:check` full check

Installed automatically via `postinstall` script (`lefthook install`).

## TypeScript Check

```bash
bun run typecheck   # tsc --noEmit
```

## CI (GitHub Actions)

Pipeline: `bun install --frozen-lockfile` → `bun run oxc:check` → `bun run typecheck` → `bun run test:build`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI framework (command registration, option parsing) |
| `chalk` | Terminal colors |
| `better-result` | Typed Result error handling |
| `marked` + `marked-terminal` | Markdown rendering in terminal |
| `fuse.js` | Fuzzy search for `elysia search` |
| `esbuild` | Bundle for `elysia optimize`; Node.js transpile for `elysia serve` |
| `chokidar` | File watching (Node.js `elysia serve` fallback) |
| `up-fetch` | HTTP client for GitHub API |

## tsconfig

- `strict: true`, `noUncheckedIndexedAccess: true`
- `moduleResolution: "bundler"`
- Path alias: `~/*` → `./src/*`
- Target: ES2022, ESM (`"type": "module"`)
- Import paths must include `.js` extension (ESM resolution)
