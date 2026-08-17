import { Layers } from 'lucide-react';

/**
 * Sidebar shell. Contents (types, collections, user area) land in phase 2.
 */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Layers className="size-4.5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">DevFetch</span>
      </div>

      <div className="flex-1 px-4 py-6">
        <h2 className="text-lg font-semibold">Sidebar</h2>
      </div>
    </aside>
  );
}
