---
name: coding-standards
description: Coding standards, best practices, and patterns for TypeScript and Node.js/Bun CLI development.
origin: ECC
---

# Coding Standards & Best Practices

Coding standards applicable to this TypeScript CLI project.

## When to Activate

- Starting a new module or command
- Reviewing code for quality and maintainability
- Refactoring existing code to follow conventions
- Enforcing naming, formatting, or structural consistency
- Onboarding new contributors to coding conventions

## Code Quality Principles

### 1. Readability First

- Code is read more than written
- Clear variable and function names
- Self-documenting code preferred over comments
- Consistent formatting (enforced by oxfmt)

### 2. KISS (Keep It Simple, Stupid)

- Simplest solution that works
- Avoid over-engineering
- No premature optimization
- Easy to understand > clever code

### 3. DRY (Don't Repeat Yourself)

- Extract common logic into functions
- Share utilities across modules
- Avoid copy-paste programming

### 4. YAGNI (You Aren't Gonna Need It)

- Don't build features before they're needed
- Add complexity only when required
- Start simple, refactor when needed

## TypeScript Standards

### Variable Naming

```typescript
// ✅ GOOD: Descriptive names
const docsRepoPath = "essential/route";
const isBunRuntime = true;
const cacheExpiryMs = 24 * 60 * 60 * 1000;

// ❌ BAD: Unclear names
const p = "essential/route";
const flag = true;
const x = 86400000;
```

### Function Naming

```typescript
// ✅ GOOD: Verb-noun pattern
async function fetchDoc(path: DocsRepoRelativePath): Promise<Result<string, Error>> {}
function parseSearchOptions(raw: SearchCliOptionsRaw): SearchResolvedOptions {}
function isCacheValid(cachePath: string): boolean {}

// ❌ BAD: Unclear or noun-only
async function doc(p: string) {}
function options(raw: any) {}
```

### Immutability Pattern (CRITICAL)

```typescript
// ✅ ALWAYS use spread operator
const updatedOptions = {
  ...options,
  port: 8080,
};

const updatedArray = [...routes, newRoute];

// ❌ NEVER mutate directly
options.port = 8080; // BAD
routes.push(newRoute); // BAD
```

### Error Handling with better-result

```typescript
import { Result } from "better-result";

// ✅ GOOD: Result pattern for fallible operations
async function fetchDoc(path: string): Promise<Result<string, Error>> {
  return Result.tryPromise({
    try: async () => await fetcher(path),
    catch: (e) => (e instanceof Error ? e : new Error(String(e))),
  });
}

// Use exitOnError in CLI command actions
const content = exitOnError(await fetchDoc(path));

// ❌ BAD: Swallowing errors silently
async function fetchDoc(path: string) {
  try {
    return await fetcher(path);
  } catch {
    return null; // Silent failure
  }
}
```

### Async/Await Best Practices

```typescript
// ✅ GOOD: Parallel execution when possible
const [docsContent, searchIndex] = await Promise.all([fetchDoc(path), loadSearchIndex()]);

// ❌ BAD: Sequential when unnecessary
const docsContent = await fetchDoc(path);
const searchIndex = await loadSearchIndex();
```

### Type Safety

```typescript
// ✅ GOOD: Proper types with no any
interface DocsResolvedOptions {
  cache: boolean;
}

function parseDocsOptions(raw: Partial<{ cache: boolean }>): DocsResolvedOptions {
  return { cache: raw.cache !== false };
}

// ❌ BAD: Using 'any'
function parseDocsOptions(raw: any): any {
  return raw;
}
```

## File Organization

### Project Structure

```
src/
├── cli.ts                    # Entry point — registers all commands
├── commands/
│   ├── docs/index.ts         # registerDocsCommand(program)
│   ├── search/index.ts       # registerSearchCommand(program)
│   ├── request/index.ts      # registerRequestCommand(program)
│   ├── serve/index.ts        # registerServeCommand(program)
│   └── optimize/index.ts     # registerOptimizeCommand(program)
├── constants/                # Shared constants
├── types/                    # TypeScript types and brand types
└── utils/
    ├── display.ts            # Terminal output helpers
    ├── fetcher.ts            # HTTP fetch utilities
    ├── loader.ts             # App entry resolution
    ├── routes.ts             # Route extraction
    └── runtime.ts            # Bun/Node.js detection
```

### File Naming

```
src/commands/docs/index.ts       # camelCase for modules
src/utils/display.ts             # camelCase for utilities
src/types/http-method.ts         # kebab-case for type files
```

## Comments & Documentation

### When to Comment

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Use exponential backoff to avoid overwhelming the GitHub API during outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);

// Commander passes inverted --no-cache as cache: false
const cache = raw.cache !== false;

// ❌ BAD: Stating the obvious
// Check if cache is valid
const isValid = isCacheValid(cachePath);
```

### JSDoc for Exported Functions

```typescript
/**
 * Fetch documentation from the ElysiaJS documentation repository.
 *
 * @param docPath - Repo-relative path to the documentation file
 * @returns Ok with the markdown content, or Err with a descriptive error
 */
export async function fetchDoc(docPath: DocsRepoRelativePath): Promise<Result<string, Error>> {
  // Implementation
}
```

## Testing Standards

### Test Structure (AAA Pattern)

```typescript
import { describe, it, expect, vi } from "vitest";

describe("functionName", () => {
  it("returns expected value for valid input", () => {
    // Arrange
    const input = "essential/route";

    // Act
    const result = normalizeDocsRepoRelativePath(input);

    // Assert
    expect(result).toBe("essential/route.md");
  });
});
```

### Test Naming

```typescript
// ✅ GOOD: Descriptive test names
it("returns empty array when no routes match", () => {});
it("throws on invalid entry file path", () => {});
it("falls back to Node.js mode when Bun is unavailable", () => {});

// ❌ BAD: Vague test names
it("works", () => {});
it("test route", () => {});
```

## Code Smell Detection

Watch for these anti-patterns:

### 1. Long Functions (>50 lines)

```typescript
// ❌ BAD: Function > 50 lines
function processCommand() {
  // 100 lines of code
}

// ✅ GOOD: Split into smaller functions
function processCommand() {
  const opts = parseOptions(raw);
  const result = await runCommand(opts);
  return exitOnError(result);
}
```

### 2. Deep Nesting (>4 levels)

```typescript
// ❌ BAD: 5+ levels of nesting
if (entry) {
  if (app) {
    if (routes) {
      if (routes.length > 0) {
        for (const route of routes) {
          // ...
        }
      }
    }
  }
}

// ✅ GOOD: Early returns
if (!entry) return
if (!app) return
if (!routes?.length) return

for (const route of routes) { ... }
```

### 3. Magic Numbers

```typescript
// ❌ BAD: Unexplained numbers
if (retryCount > 3) {
}
const ttl = 86400000;

// ✅ GOOD: Named constants
const MAX_RETRIES = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

if (retryCount > MAX_RETRIES) {
}
```

**Remember**: Code quality is not negotiable. Clear, maintainable code enables rapid development and confident refactoring.
