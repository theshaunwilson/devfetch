# DevFetch

A developer knowledge hub for snippets, commands, prompts, notes, files, images, links and custom types.

## Context Files

Read the following to get the full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

- **Dev server**: `npm run dev` (runs on http://localhost:3000)
- **Build**: `npm run build`
- **Production server**: `npm run start`
- **Lint**: `npm run lint`

## Neon MCP

Whenever you use the Neon MCP for this project:

- **Project**: `devfetch` — `projectId: broad-rice-92990147`
- **Branch**: `development` — `branchId: br-gentle-tooth-zavtxrsu` (default for every call)

Always pass `branchId` explicitly. Omitting it targets the project's default
branch, which is `production` — never rely on the default.

### Production is off-limits

- Never run any query — read or write — against `production`
  (`br-super-art-zaaw2pc8`) unless I name it in that request.
- Permission to touch production applies to that one request only. Do not carry
  it forward to later calls in the same session.
- Never create, delete, or reset branches, and never run migrations against
  production without asking first.

### On the development branch

- Read-only SQL (`SELECT`, `EXPLAIN`, describes) is fine without asking.
- Ask before `INSERT`/`UPDATE`/`DELETE`/`DROP`/`TRUNCATE` or any DDL, even here.
- Schema changes go through `prisma migrate dev`, not raw SQL through the MCP.
