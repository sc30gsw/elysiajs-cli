---
name: tdd-workflow
description: Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 80%+ coverage including unit and integration tests.
origin: ECC
---

# Test-Driven Development Workflow

This skill ensures all code development follows TDD principles with comprehensive test coverage.

## When to Activate

- Writing new CLI commands or utilities
- Fixing bugs (write test that reproduces bug first)
- Refactoring existing code
- Adding new option parsing logic
- Extending display helpers

## Core Principles

### 1. Tests BEFORE Code
ALWAYS write tests first, then implement code to make tests pass.

### 2. Coverage Requirements
- Minimum 80% coverage (unit + integration)
- All edge cases covered
- Error scenarios tested
- Boundary conditions verified

### 3. Test Types

#### Unit Tests
- Individual utility functions in `src/utils/`
- Option parsing logic (`parseXxxOptions`)
- Type guards and brand type constructors
- Pure functions

#### Integration Tests
- Full CLI command behavior end-to-end
- Spawn the built CLI binary, assert stdout/stderr/exit code
- Use fixtures in `test/fixtures/`

## TDD Workflow Steps

### Step 1: Define the Interface
```typescript
// src/utils/someUtil.ts — define the type signature first
export function parsePort(raw: string | undefined): number {
  // TODO: Implementation
  throw new Error('Not implemented')
}
```

### Step 2: Write Failing Test (RED)
```typescript
// test/commands/someUtil.test.ts
import { describe, it, expect } from 'vitest'
import { parsePort } from '~/utils/someUtil.js'

describe('parsePort', () => {
  it('returns default port when undefined', () => {
    expect(parsePort(undefined)).toBe(3000)
  })

  it('parses valid port string', () => {
    expect(parsePort('8080')).toBe(8080)
  })

  it('throws on invalid port', () => {
    expect(() => parsePort('invalid')).toThrow('Invalid port')
  })

  it('throws on out-of-range port', () => {
    expect(() => parsePort('99999')).toThrow('Invalid port')
  })
})
```

### Step 3: Run Tests — They Should FAIL
```bash
bun run test
# ✕ parsePort > returns default port when undefined
# Error: Not implemented
```

### Step 4: Implement Minimal Code (GREEN)
```typescript
// src/utils/someUtil.ts
export function parsePort(raw: string | undefined): number {
  if (raw === undefined) return 3000
  const port = Number(raw)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${raw}. Must be 1-65535.`)
  }
  return port
}
```

### Step 5: Run Tests — They Should PASS
```bash
bun run test
# ✓ parsePort > returns default port when undefined
# ✓ parsePort > parses valid port string
# ✓ parsePort > throws on invalid port
# ✓ parsePort > throws on out-of-range port
# 4 tests passed
```

### Step 6: Refactor (IMPROVE)
Improve code quality while keeping tests green.

### Step 7: Verify Coverage
```bash
bun run test:coverage
# Verify 80%+ coverage achieved
```

## Testing Patterns

### Unit Test Pattern (Vitest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('isCacheValid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when file does not exist', () => {
    vi.mock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(false),
      statSync: vi.fn()
    }))

    expect(isCacheValid('/tmp/nonexistent.md')).toBe(false)
  })

  it('returns false when cache is expired', () => {
    vi.mock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      statSync: vi.fn().mockReturnValue({ mtimeMs: Date.now() - 25 * 60 * 60 * 1000 })
    }))

    expect(isCacheValid('/tmp/old.md')).toBe(false)
  })

  it('returns true when cache is fresh', () => {
    vi.mock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      statSync: vi.fn().mockReturnValue({ mtimeMs: Date.now() - 1000 })
    }))

    expect(isCacheValid('/tmp/fresh.md')).toBe(true)
  })
})
```

### Result Type Test Pattern

```typescript
import { describe, it, expect } from 'vitest'

describe('fetchDoc', () => {
  it('returns Ok on success', async () => {
    vi.mock('~/utils/fetcher.js', () => ({
      docsFetcher: vi.fn().mockResolvedValue('# Hello World')
    }))

    const result = await fetchDoc('essential/route' as DocsRepoRelativePath)

    expect(result.isOk()).toBe(true)
    result.match({
      ok: (content) => expect(content).toContain('Hello World'),
      err: () => { throw new Error('Should not be error') }
    })
  })

  it('returns Err on 404', async () => {
    vi.mock('~/utils/fetcher.js', () => ({
      docsFetcher: vi.fn().mockRejectedValue(
        Object.assign(new Error('Not Found'), { status: 404 })
      )
    }))

    const result = await fetchDoc('missing/path' as DocsRepoRelativePath)

    expect(result.isErr()).toBe(true)
    result.match({
      ok: () => { throw new Error('Should not be ok') },
      err: (e) => expect(e.message).toContain('not found')
    })
  })
})
```

### CLI Integration Test Pattern

```typescript
// test/integration/cli.integration.test.ts
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import { resolve } from 'path'

const CLI = resolve('dist/cli.js')

describe('elysia search', () => {
  it('outputs JSON array for valid query', () => {
    const { stdout, status } = spawnSync('node', [CLI, 'search', 'route'], {
      encoding: 'utf-8'
    })

    expect(status).toBe(0)
    const results = JSON.parse(stdout)
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns empty array when no results', () => {
    const { stdout, status } = spawnSync('node', [CLI, 'search', 'xyznotfound12345'], {
      encoding: 'utf-8'
    })

    expect(status).toBe(0)
    expect(JSON.parse(stdout)).toEqual([])
  })
})
```

## Test File Organization

```
test/
├── commands/
│   ├── display.test.ts       # src/utils/display.ts tests
│   ├── loader.test.ts        # src/utils/loader.ts tests
│   ├── request.test.ts       # request command logic tests
│   ├── routes.test.ts        # route extraction tests
│   └── runtime.test.ts       # Bun/Node detection tests
├── integration/
│   └── cli.integration.test.ts   # full CLI end-to-end tests
└── fixtures/
    ├── basic-app.ts          # Elysia app used by tests
    └── serve-http-entry.ts   # serve command fixture
```

## Mocking in Vitest (NOT Jest)

```typescript
// ✅ CORRECT: Vitest API
import { vi } from 'vitest'

const mockFn = vi.fn()
const mockAsync = vi.fn().mockResolvedValue('value')

vi.mock('~/utils/fetcher.js', () => ({
  docsFetcher: vi.fn()
}))

vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called') })

// Clean up between tests
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

// ❌ WRONG: Jest API (not available in this project)
jest.fn()        // Does not exist
jest.mock()      // Does not exist
```

## Coverage Thresholds (vitest.config.ts)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
})
```

## Common Testing Mistakes to Avoid

### ❌ WRONG: Using Jest API
```typescript
jest.fn()           // Wrong — use vi.fn()
jest.mock('./foo')  // Wrong — use vi.mock('./foo')
```

### ✅ CORRECT: Using Vitest API
```typescript
vi.fn()
vi.mock('./foo')
```

### ❌ WRONG: No Test Isolation
```typescript
let cache = {}

test('sets cache', () => { cache['key'] = 'value' })
test('reads cache', () => { expect(cache['key']).toBe('value') })  // Depends on previous test
```

### ✅ CORRECT: Independent Tests
```typescript
test('sets cache', () => {
  const cache = {}
  cache['key'] = 'value'
  expect(cache['key']).toBe('value')
})
```

## Continuous Testing

```bash
# Watch mode during development
bun run test:watch

# Pre-commit (run via lefthook automatically)
bun run test

# CI pipeline
bun run test:build  # Build + test
```

## Best Practices

1. **Write Tests First** - Always TDD
2. **One Behavior Per Test** - Focus on single behavior
3. **Descriptive Test Names** - Explain what's tested
4. **Arrange-Act-Assert** - Clear test structure
5. **Use `vi.*`** - This is Vitest, NOT Jest
6. **Test Edge Cases** - Null, undefined, empty, invalid, out-of-range
7. **Test Error Paths** - Not just happy paths
8. **Keep Tests Fast** - Unit tests < 50ms each
9. **No Shared State** - Each test sets up its own data

---

**Remember**: Tests are not optional. They are the safety net that enables confident refactoring and reliable releases.
