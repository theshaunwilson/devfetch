import { FolderPlus, Plus, Search } from 'lucide-react';
import { Brand } from '@/components/dashboard/Brand';
import { TopbarToggle } from '@/components/dashboard/TopbarToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Top bar shell. Search and the create buttons are still display only.
 */
export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
      <TopbarToggle />

      <Brand className="shrink-0 md:hidden" />

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
        <Button className="h-10">
          <Plus className="size-4" />
          New Item
        </Button>
      </div>
    </header>
  );
}
