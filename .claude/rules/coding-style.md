---
paths:
  - "**/*.ts"
---
# TypeScript Coding Style

## Types and Interfaces

Use types to make public APIs, shared models, and utility functions explicit.

### Public APIs

- Add parameter and return types to exported functions, shared utilities, and public class methods
- Let TypeScript infer obvious local variable types
- Extract repeated inline object shapes into named types or interfaces

```typescript
// WRONG: Exported function without explicit types
export function formatUser(user) {
  return `${user.firstName} ${user.lastName}`
}

// CORRECT: Explicit types on public APIs
interface User {
  firstName: string
  lastName: string
}

export function formatUser(user: User): string {
  return `${user.firstName} ${user.lastName}`
}
```

### Interfaces vs. Type Aliases

- Use `interface` for object shapes that may be extended or implemented
- Use `type` for unions, intersections, tuples, mapped types, and utility types
- Prefer string literal unions over `enum` unless an `enum` is required for interoperability

```typescript
interface User {
  id: string
  email: string
}

type UserRole = 'admin' | 'member'
type UserWithRole = User & {
  role: UserRole
}
```

### Avoid `any`

- Avoid `any` in application code
- Use `unknown` for external or untrusted input, then narrow it safely
- Use generics when a value's type depends on the caller

```typescript
// WRONG: any removes type safety
function getErrorMessage(error: any) {
  return error.message
}

// CORRECT: unknown forces safe narrowing
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unexpected error'
}
```

### Brand Types and Type Guards

Use branded types for domain-specific string values, and `as const satisfies` for typed constants:

```typescript
// Brand type for domain-specific strings
type DocsRepoRelativePath = string & { readonly __brand: 'DocsRepoRelativePath' }

// Type guard
function isElysiaApp(value: unknown): value is Elysia {
  return value instanceof Elysia
}

// as const satisfies for typed constants
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const satisfies readonly string[]
```

## Immutability

Use spread operator for immutable updates. NEVER mutate existing objects.

```typescript
// WRONG: Mutation
function updateOptions(opts: Options, key: keyof Options, val: unknown): Options {
  opts[key] = val  // MUTATION!
  return opts
}

// CORRECT: Immutability
function updateOptions(opts: Readonly<Options>, port: number): Options {
  return { ...opts, port }
}
```

## Error Handling with better-result

This project uses `better-result` for typed error handling. Prefer `Result` over bare `try/catch` in business logic:

```typescript
import { Result } from 'better-result'

// Result.tryPromise for async operations that can fail
async function fetchDoc(path: string): Promise<Result<string, Error>> {
  return Result.tryPromise({
    try: async () => {
      const content = await fetcher(path)
      return content
    },
    catch: (e) => e instanceof Error ? e : new Error(String(e)),
  })
}

// Result.gen for sequential operations with early exit on error
async function processDoc(path: string): Promise<Result<void, Error>> {
  return Result.gen(async function* () {
    const content = yield* fetchDoc(path)
    const parsed = yield* parseContent(content)
    await renderMarkdown(parsed)
  })
}

// Result.try for synchronous operations
function parseJson(input: string): Result<unknown, Error> {
  return Result.try(() => JSON.parse(input))
}
```

## Terminal Output

Use helpers from `~/utils/display.ts`. Do NOT use `console.log` directly in command code.

```typescript
import { success, error, info, dim, header, elapsed, exitOnError } from '~/utils/display.js'

success('Build complete')         // ✓ message (green)
error('Command failed')           // ✗ message (red, stderr)
info('Fetching documentation')    // ℹ message (blue)
dim('(from cache)')               // dimmed message
header('Elysia Documentation')    // bold cyan header with separator

// Exit on Result error — prints error message and calls process.exit(1)
const content = exitOnError(await fetchDoc(path))
```

## Input Validation

CLI options follow the `Raw → Resolved` pattern. Validate and normalize at the boundary:

```typescript
// Raw type: what commander passes (partial, as-is)
type DocsCliOptionsRaw = Partial<{ cache: boolean }>

// Resolved type: fully normalized with defaults applied
interface DocsResolvedOptions {
  cache: boolean
}

// Parse function: apply defaults
function parseDocsOptions(raw: DocsCliOptionsRaw): DocsResolvedOptions {
  return {
    cache: raw.cache !== false,  // --no-cache sets cache: false
  }
}
```

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Organize by feature/domain: `src/commands/`, `src/utils/`, `src/types/`

## Code Quality Checklist

Before marking work complete:
- [ ] Exported functions have explicit parameter and return types
- [ ] No `any` — use `unknown` + narrowing or generics
- [ ] No mutation — use spread operator
- [ ] Errors handled via `Result` or `try/catch` (never silently swallowed)
- [ ] Terminal output via `display.ts` helpers (not raw `console.log`)
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No hardcoded values (use constants or config)
