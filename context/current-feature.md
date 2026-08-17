# Current Feature

<!-- Feature Name -->

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

## Notes

<!-- Any extra notes -->

## History

<!-- Keep this updated. Earliest to latest -->

- Initial Next.js 16 setup (React 19, TypeScript, Tailwind CSS v4, ESLint) via create-next-app
- Project setup and boilerplate cleanup
- Mock data source added for the dashboard UI
- Dashboard UI Phase 1 — ShadCN init, `/dashboard` route, dashboard layout shell, dark mode by default, display-only top bar, sidebar/main placeholders
- Dashboard UI Phase 2 — collapsible sidebar built from mock data: item types linking to `/items/[slug]`, favorite and recent collections, user area, and a "Navigation" row holding the collapse toggle on desktop / the close X in the mobile drawer. Sidebar state lives in `SidebarProvider`; the top bar shows a hamburger below `md` and only shows the panel toggle while the sidebar is collapsed. The DevFetch brand moves to the top bar below `md`
