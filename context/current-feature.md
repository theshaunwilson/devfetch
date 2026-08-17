# Current Feature

<!-- Feature Name -->

Dashboard UI — Phase 1 (Layout Shell)

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

Phase 1 of 3 for the dashboard UI layout. Match the referenced screenshot.

- ShadCN UI initialization and components
- ShadCN component installation
- Dashboard route at `/dashboard`
- Main dashboard layout and any global styles
- Dark mode by default
- Top bar with search and new item button (display only)
- Placeholder for sidebar and main area — just an `h2` with "Sidebar" and "Main" for now

## Notes

<!-- Any extra notes -->

- Spec: @context/features/dashboard-phase-1-spec.md
- Reference screenshot: @docs/images/dashboard.png
- Mock data: @src/lib/mock-data.ts
- Later phases: @context/features/dashboard-phase-2-spec.md, @context/features/dashboard-phase-3-spec.md
- Top bar controls are display only in this phase (no search or create behavior yet)
- ShadCN v4 dropped the `default`/`new-york` styles; initialized with the `nova` preset on the Radix base, `neutral` base color
- Sidebar shares the main background (separated only by `border-r`); hidden below `md` until the phase 2 drawer lands
- Components installed for later phases too: button, input, separator, avatar, dropdown-menu, card, badge, tooltip, scroll-area, sheet
- `/` still renders the old placeholder page — no redirect to `/dashboard` was added

## History

<!-- Keep this updated. Earliest to latest -->

- Initial Next.js 16 setup (React 19, TypeScript, Tailwind CSS v4, ESLint) via create-next-app
- Project setup and boilerplate cleanup
- Mock data source added for the dashboard UI
- Dashboard UI Phase 1 — ShadCN init, `/dashboard` route, dashboard layout shell, dark mode by default, display-only top bar, sidebar/main placeholders
