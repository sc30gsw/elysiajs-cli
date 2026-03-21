# Testing Requirements

## Minimum Test Coverage: 80%

**Test framework:** Vitest + @vitest/coverage-v8

**Commands:**

```bash
bun run test              # Run all tests
bun run test:coverage     # Run with coverage report
bun run test:watch        # Watch mode (vitest --watch)
bun run test:build        # Build then test (CI)
```

## Test Types

1. **Unit Tests** — Individual functions and utilities in `src/utils/`, `src/types/`
2. **Integration Tests** — CLI command behavior (test the command logic end-to-end)

## Test Directory Structure

```
test/
  commands/
    display.test.ts       # display.ts helpers
    loader.test.ts        # app loading logic
    request.test.ts       # elysia req command
    routes.test.ts        # route extraction
    runtime.test.ts       # Bun/Node.js detection
  integration/
    cli.integration.test.ts   # full CLI command tests
  fixtures/
    basic-app.ts          # Elysia app fixture
    serve-http-entry.ts   # serve command fixture
```

## Test-Driven Development

MANDATORY workflow:

1. Write test first (RED)
2. Run test — it should FAIL: `bun run test`
3. Write minimal implementation (GREEN)
4. Run test — it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (80%+)

## Vitest Patterns

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("functionName", () => {
  it("returns expected value for valid input", () => {
    // Arrange
    const input = "test";

    // Act
    const result = functionName(input);

    // Assert
    expect(result).toBe("expected");
  });

  it("handles error case", async () => {
    // Use vi.fn() for mocks (NOT jest.fn())
    const mockFn = vi.fn().mockResolvedValue("value");

    // Use vi.mock() for module mocks (NOT jest.mock())
    vi.mock("~/utils/fetcher.js", () => ({
      docsFetcher: vi.fn().mockRejectedValue(new Error("Network error")),
    }));
  });
});
```

## CLI Integration Test Pattern

```typescript
import { execa } from "execa";
import { describe, it, expect } from "vitest";

describe("elysia docs command", () => {
  it("shows table of contents", async () => {
    const { stdout, exitCode } = await execa("node", ["dist/cli.js", "docs"], {
      env: { ...process.env },
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Elysia");
  });
});
```

## Edge Cases to Always Test

1. **Null/undefined** input
2. **Empty** arrays/strings
3. **Invalid types** passed
4. **Error paths** (network failures, file not found)
5. **Boundary values** (min/max)

## Troubleshooting Test Failures

1. Use **tdd-guide** agent
2. Check test isolation (no shared state between tests)
3. Verify mocks use `vi.fn()` / `vi.mock()` (not jest equivalents)
4. Fix implementation, not tests (unless tests are wrong)
