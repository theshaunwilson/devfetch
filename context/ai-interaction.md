# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Workflow

This is the common workflow that we will use for every single feature/fix:

1. **Document** - Document the feature in @context/current-feature.md.
2. **Branch** - Create new branch for feature, fix, etc
3. **Implement** - Implement the feature/fix that I create in @context/current-feature.md
4. **Test** - Write unit tests for any new or changed server action or utility, and run `npm run test`. Verify UI work in the browser — components are not unit tested. Run `npm run lint` and `npm run build` and fix any errors
5. **Iterate** - Iterate and change things if needed
6. **Commit** - Only after build passes and everything works
7. **Merge** - Merge to main
8. **Delete Branch** - Delete branch after merge
9. **Review** - Review AI-generated code periodically and on demand.
10. Mark as completed in @context/current-feature.md and add to history

Do NOT commit without permission and until the tests and the build both pass. If either fails, fix the issues first.

## Branching

We will create a new branch for every feature/fix. Name branch **feature/[feature]** or **fix[fix]**, etc. Ask to delete the branch once merged.

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated With Claude" in the commit messages

## Testing

Unit tests run on **Vitest**. `npm run test` runs them once, `npm run test:watch`
watches, `npm run test:coverage` adds a coverage report.

**What is tested: server actions and utilities. Not components.** A server action
is a public endpoint and a utility is pure logic — both are worth pinning down in
a test. Components are verified in the browser, as step 4 of the workflow says.

- Tests sit next to what they test: `src/lib/format.test.ts` beside
  `src/lib/format.ts`.
- Test files are always `.ts`, never `.tsx`. The Vitest `include` pattern is
  `src/**/*.test.ts`, so a component test — which needs JSX, so needs `.tsx` —
  is not collected. The scope is enforced by the glob, not by memory.
- A test never touches the database, Redis or the network. Mock the module
  boundary (`@/auth`, `@/lib/prisma`, `@/lib/rate-limit`) and leave the pure
  modules real, so the action is tested against the same schemas and helpers
  production runs. `src/actions/auth.test.ts` is the worked example.
- Test the decision, not the implementation: the security properties are the
  ones worth a test — that `safeCallbackUrl` rejects `//evil.example`, that
  `EMAIL_VERIFICATION` fails secure when unset, that a failed sign-in never
  echoes the password back.

When adding a test, check it can fail: break the source, watch the test go red,
put the source back. A test that passes either way is worse than no test.

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)
