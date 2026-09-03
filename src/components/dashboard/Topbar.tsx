import { FolderPlus, Search } from 'lucide-react';
import { TopbarBrand } from '@/components/dashboard/TopbarBrand';
import { TopbarToggle } from '@/components/dashboard/TopbarToggle';
import { NewItemDialog } from '@/components/items/NewItemDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SidebarItemType } from '@/types/item';

/**
 * Top bar shell. Search and New Collection are still display only.
 *
 * The item types come down from `AppShell`, which already loads them for the
 * sidebar, so the dialog costs no query of its own.
 */
export function Topbar({ itemTypes }: { itemTypes: SidebarItemType[] }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
      <TopbarToggle />

      <TopbarBrand />

      <div className="relative min-w-0 flex-1 sm:max-w-lg">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search items..."
          className="h-10 pr-3 pl-9 sm:pr-16"
          aria-label="Search items"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
          ⌘ K
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button variant="outline" className="hidden h-10 md:inline-flex">
          <FolderPlus className="size-4" />
          New Collection
        </Button>
        <NewItemDialog itemTypes={itemTypes} />
      </div>
    </header>
  );
}
