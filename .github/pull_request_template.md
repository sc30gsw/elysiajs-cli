# Summary

<!-- Briefly describe the purpose and background of this PR -->

## Related Links

- Issue:
- Related PR:

## Changes

<!-- Describe the files and features changed -->
<!-- Organize by project structure where applicable -->

```
src/
├── commands/
│   └── [command-name]/
│       └── index.ts
├── utils/
├── types/
└── ...
```

-

## Out of Scope

<!-- List items explicitly NOT addressed in this PR -->

-

## Screenshots / Verification

<!-- If there are terminal output or behavior changes, attach Before/After examples -->

| Before | After |
| ------ | ----- |
|        |       |

## Review Focus

<!-- Design decisions, implementation choices, or areas requiring special attention -->

-

## Self-Checklist

### Code Quality

- [ ] TypeScript type safety ensured (minimize use of `any`)
- [ ] Imports use `~` alias (no relative paths)
- [ ] Named exports used throughout
- [ ] `better-result` used for error handling in fallible operations
- [ ] TypeScript utility types leveraged (`Pick`, `Omit`, `Record`, etc.)
- [ ] No `console.log` statements left in source files

### Project Structure

- [ ] Command follows the `registerXxxCommand(program)` pattern
- [ ] Raw → Resolved options pattern applied for Commander options
- [ ] Terminal output goes through `~/utils/display.ts` helpers

### Static Analysis

- [ ] `bun run oxc:check` passes (oxlint + oxfmt)
- [ ] `bun run typecheck` passes (tsc --noEmit)
- [ ] Production build (`bun run build`) succeeds

### Tests

- [ ] Unit / integration tests added or updated
- [ ] `bun run test` passes
- [ ] Coverage maintained at 80%+

### Security

- [ ] No hardcoded secrets (tokens, API keys, passwords)
- [ ] External data (GitHub API, docs content) treated as untrusted
- [ ] File path inputs sanitized (no path traversal)
- [ ] Error messages do not leak sensitive data

## Review Priority

<!-- Keep the applicable one -->

- [ ] **Low** — Minor change, quick look appreciated
- [ ] **Medium** — Normal review
- [ ] **High** — Critical change, please review carefully

## Notes

<!-- Any additional remarks -->
