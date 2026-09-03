# Coding Standards

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- Use Server Actions for form submissions and simple mutations
- Use API routes when you need:
  - Webhooks (Stripe, GitHub, etc.)
  - File uploads with progress tracking
  - Long-running operations
  - Specific HTTP status codes or headers
  - Endpoints for future mobile/CLI clients
  - Third-party integrations
- Otherwise, fetch data directly in server components
- Dynamic routes for item/collection pages

## Tailwind CSS v4

**CRITICAL**: We are using Tailwind CSS v4, which uses CSS-based configuration.

- **DO NOT** create `tailwind.config.ts` or `tailwind.config.js` files (those are for v3)
- All theme configuration must be done in CSS using the `@theme` directive in `src/app/globals.css`
- Use CSS custom properties for colors, spacing, etc.
- No JavaScript-based config allowed

Example v4 configuration:

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(50% 0.2 250);
}

## File Organization

- Components: `src/components/[feature]/ComponentName.tsx`
- Pages: `src/app/[route]/page.tsx`
- Server Actions: `src/actions/[feature].ts`
- Types: `src/types/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts`
- Tests: co-located `[subject].test.ts` next to the file under test

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS for all styling
- Use shadcn/ui components where applicable
- No inline styles
- Dark mode first, light mode as option

## Database

- Use Prisma ORM for all database operations
- Always use `prisma migrate dev` for schema changes (not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Production deployments must run `prisma migrate deploy` before the app starts

## Data Fetching

- Server components fetch directly with Prisma
- Client components use Server Actions
- Validate all inputs with Zod

## Error Handling

- Use try/catch in Server Actions
- Return `{ success, data, error }` pattern from actions
- Display user-friendly error messages via toast

## Testing

- Vitest, `environment: 'node'` — see `vitest.config.mts`
- **Test server actions (`src/actions`) and utilities (`src/lib`) only.** No
  component tests: components are verified in the browser
- Test files are `.ts`, never `.tsx`. The include glob is `src/**/*.test.ts`, so
  a `.tsx` test is not collected — that is what keeps the scope honest
- Co-locate: `src/lib/format.test.ts` next to `src/lib/format.ts`
- Import `describe`, `it`, `expect` and `vi` from `vitest` explicitly — `globals`
  is off, so nothing is magically in scope
- No database, no Redis, no network. Mock the module boundary (`@/auth`,
  `@/lib/prisma`, `@/lib/rate-limit`), not the library behind it, and leave pure
  modules (Zod schemas, `auth-errors`, `auth-redirect`) real
- `server-only` is aliased to `test/stubs/server-only.ts`; without it every
  module that imports it throws on load
- Prove a new test can fail before trusting it

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
```
