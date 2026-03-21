---
description: Enforce test-driven development workflow. Scaffold interfaces, generate tests FIRST, then implement minimal code to pass. Ensure 80%+ coverage.
---

# TDD Command

This command invokes the **tdd-guide** agent to enforce test-driven development methodology.

## What This Command Does

1. **Scaffold Interfaces** - Define types/interfaces first
2. **Generate Tests First** - Write failing tests (RED)
3. **Implement Minimal Code** - Write just enough to pass (GREEN)
4. **Refactor** - Improve code while keeping tests green (REFACTOR)
5. **Verify Coverage** - Ensure 80%+ test coverage

## When to Use

Use `/tdd` when:
- Implementing new CLI commands
- Adding new utility functions
- Fixing bugs (write test that reproduces bug first)
- Refactoring existing code
- Building critical logic (option parsing, caching, route extraction)

## How It Works

The tdd-guide agent will:

1. **Define interfaces** for inputs/outputs
2. **Write tests that will FAIL** (because code doesn't exist yet)
3. **Run tests** and verify they fail for the right reason
4. **Write minimal implementation** to make tests pass
5. **Run tests** and verify they pass
6. **Refactor** code while keeping tests green
7. **Check coverage** and add more tests if below 80%

## TDD Cycle

```
RED → GREEN → REFACTOR → REPEAT

RED:      Write a failing test
GREEN:    Write minimal code to pass
REFACTOR: Improve code, keep tests passing
REPEAT:   Next feature/scenario
```

## Test Commands

```bash
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # Coverage report
```

## Vitest API (NOT Jest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ✅ CORRECT: Vitest API
const mockFn = vi.fn()
vi.mock('~/utils/fetcher.js', () => ({ ... }))

// ❌ WRONG: Jest API (not available)
jest.fn()
jest.mock()
```

## Example Usage

```
User: /tdd I need a function to extract routes from an Elysia app

Agent (tdd-guide):
# TDD Session: Route Extractor

## Step 1: Define Interface (SCAFFOLD)

// src/utils/routes.ts
import type { Elysia } from 'elysia'

export interface ExtractedRoute {
  method: string
  path: string
}

export function extractRoutes(app: Elysia): ExtractedRoute[] {
  throw new Error('Not implemented')
}

## Step 2: Write Failing Test (RED)

// test/commands/routes.test.ts
import { describe, it, expect } from 'vitest'
import { Elysia } from 'elysia'
import { extractRoutes } from '~/utils/routes.js'

describe('extractRoutes', () => {
  it('extracts GET routes', () => {
    const app = new Elysia()
      .get('/users', () => [])
      .get('/health', () => 'ok')

    const routes = extractRoutes(app)

    expect(routes).toContainEqual({ method: 'GET', path: '/users' })
    expect(routes).toContainEqual({ method: 'GET', path: '/health' })
  })

  it('extracts multiple HTTP methods', () => {
    const app = new Elysia()
      .get('/users', () => [])
      .post('/users', () => ({}))

    const routes = extractRoutes(app)

    expect(routes.some(r => r.method === 'GET')).toBe(true)
    expect(routes.some(r => r.method === 'POST')).toBe(true)
  })

  it('returns empty array for app with no routes', () => {
    const app = new Elysia()
    expect(extractRoutes(app)).toEqual([])
  })
})

## Step 3: Run Tests — Verify FAIL

bun run test

✕ extractRoutes > extracts GET routes
  Error: Not implemented

3 tests failed, 0 passed ✅ (failing as expected)

## Step 4: Implement (GREEN)

... [implementation] ...

## Step 5: Run Tests — Verify PASS

bun run test

✓ extractRoutes > extracts GET routes
✓ extractRoutes > extracts multiple HTTP methods
✓ extractRoutes > returns empty array for app with no routes

3 tests passed ✅

## Step 8: Check Coverage

bun run test:coverage
```

## TDD Best Practices

**DO:**
- ✅ Write the test FIRST, before any implementation
- ✅ Run tests and verify they FAIL before implementing
- ✅ Write minimal code to make tests pass
- ✅ Refactor only after tests are green
- ✅ Use `vi.fn()` and `vi.mock()` — NOT jest equivalents
- ✅ Add edge cases and error scenarios

**DON'T:**
- ❌ Write implementation before tests
- ❌ Skip running tests after each change
- ❌ Write too much code at once
- ❌ Use `jest.fn()` — this is Vitest
- ❌ Test implementation details (test behavior)

## Integration with Other Commands

- Use `/plan` first to understand what to build
- Use `/tdd` to implement with tests
- Use `/build-fix` if build errors occur
- Use `/code-review` to review implementation

## Related Agents

This command invokes the `tdd-guide` agent.

The related `tdd-workflow` skill is at:
`skills/tdd-workflow/SKILL.md`
