---
description: Restate requirements, assess risks, and create step-by-step implementation plan. WAIT for user CONFIRM before touching any code.
---

# Plan Command

This command invokes the **planner** agent to create a comprehensive implementation plan before writing any code.

## What This Command Does

1. **Restate Requirements** - Clarify what needs to be built
2. **Identify Risks** - Surface potential issues and blockers
3. **Create Step Plan** - Break down implementation into phases
4. **Wait for Confirmation** - MUST receive user approval before proceeding

## When to Use

Use `/plan` when:
- Starting a new CLI command
- Making significant architectural changes
- Working on complex refactoring
- Multiple files will be affected
- Requirements are unclear or ambiguous

## How It Works

The planner agent will:

1. **Analyze the request** and restate requirements in clear terms
2. **Break down into phases** with specific, actionable steps
3. **Identify dependencies** between components
4. **Assess risks** and potential blockers
5. **Estimate complexity** (High/Medium/Low)
6. **Present the plan** and WAIT for your explicit confirmation

## Example Usage

```
User: /plan I need to add a `elysia version` command that shows the installed Elysia version

Agent (planner):
# Implementation Plan: Add `elysia version` Command

## Requirements Restatement
- Add a new `version` command to the CLI
- Read Elysia version from local project's node_modules/elysia/package.json
- Fall back to showing CLI version if Elysia not installed locally
- Output via display.ts helpers

## Implementation Phases

### Phase 1: Command Implementation (1 file)
- Create `src/commands/version/index.ts`
- Export `registerVersionCommand(program: Command)`
- Use `Result.try(() => JSON.parse(...))` to safely read package.json
- Use `isPackageJsonWithVersion()` type guard
- Use `info()` from display.ts for output

### Phase 2: Registration (1 file)
- Update `src/cli.ts` to import and register the new command

### Phase 3: Tests (2 files)
- Unit test: `test/commands/version.test.ts`
  - Returns correct version when Elysia installed
  - Falls back gracefully when not installed
- Integration test: update `test/integration/cli.integration.test.ts`
  - `elysia version` exits 0

## Dependencies
- None (uses existing utilities)

## Risks
- LOW: package.json structure may vary — use type guard
- LOW: Elysia not installed in test environment — mock fs

## Estimated Complexity: LOW
- Implementation: 30 min
- Tests: 30 min

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
```

## Important Notes

**CRITICAL**: The planner agent will **NOT** write any code until you explicitly confirm the plan with "yes" or "proceed" or similar affirmative response.

If you want changes, respond with:
- "modify: [your changes]"
- "different approach: [alternative]"
- "skip phase 2 and do phase 3 first"

## Integration with Other Commands

After planning:
- Use `/tdd` to implement with test-driven development
- Use `/build-fix` if build errors occur
- Use `/code-review` to review completed implementation

## Related Agents

This command invokes the `planner` agent.

For manual installs, the source file lives at:
`agents/planner.md`
