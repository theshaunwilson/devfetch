import { Circle, Folder, Star } from 'lucide-react';
import { Brand } from '@/components/dashboard/Brand';
import { SidebarCloseButton } from '@/components/dashboard/SidebarCloseButton';
import { SidebarItem } from '@/components/dashboard/SidebarItem';
import { SidebarSection } from '@/components/dashboard/SidebarSection';
import { SidebarToggle } from '@/components/dashboard/SidebarToggle';
import { SidebarUser } from '@/components/dashboard/SidebarUser';
import { SidebarViewAll } from '@/components/dashboard/SidebarViewAll';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { textColorClass } from '@/lib/colors';
import { capitalize } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { isProType } from '@/lib/pro';
import { cn } from '@/lib/utils';
import type { SidebarCollections } from '@/types/collection';
import type { SidebarItemType } from '@/types/item';
import type { CurrentUser } from '@/types/user';

interface SidebarContentProps {
  itemTypes: SidebarItemType[];
  collections: SidebarCollections;
  /** Null when the seeded demo user is missing; the user area is then hidden. */
  user: CurrentUser | null;
}

/** Marks an item type as Pro-only. Sits left of the row's item count. */
function ProBadge() {
  return (
    <Badge
      variant="outline"
      className="h-4 px-1.5 text-[10px] tracking-wider text-muted-foreground"
    >
      PRO
    </Badge>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/** Sidebar body shared by the desktop sidebar and the mobile drawer. */
export function SidebarContent({ itemTypes, collections, user }: SidebarContentProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <Brand href="/dashboard" className="hidden h-16 shrink-0 px-4 md:flex" />

      <div className="group flex shrink-0 items-center justify-between gap-2 py-3 pr-3 pl-5 md:py-1">
        <h2 className="text-sm text-muted-foreground transition-colors group-hover:font-bold group-hover:text-foreground">
          Navigation
        </h2>
        <SidebarCloseButton className="md:hidden" />
        <SidebarToggle size="icon-sm" className="hidden md:inline-flex" />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col px-3 pt-2 pb-4">
          <SidebarSection title="Types">
            {itemTypes.map((type) => (
              <SidebarItem
                key={type.id}
                href={`/items/${type.slug}`}
                label={capitalize(type.name)}
                icon={getIcon(type.icon)}
                iconClassName={textColorClass(type.color)}
                count={type.itemCount}
                trailing={isProType(type.slug) ? <ProBadge /> : undefined}
              />
            ))}
          </SidebarSection>

          <Separator className="my-4" />

          <SidebarSection title="Collections">
            {collections.favorites.length > 0 && (
              <>
                <GroupLabel>Favorites</GroupLabel>
                {collections.favorites.map((collection) => (
                  <SidebarItem
                    key={collection.id}
                    href={`/collections/${collection.id}`}
                    label={collection.name}
                    icon={Folder}
                    trailing={<Star className="size-3.5 fill-yellow-500 text-yellow-500" />}
                  />
                ))}
              </>
            )}

            {collections.recent.length > 0 && (
              <>
                <GroupLabel>Recent</GroupLabel>
                {collections.recent.map((collection) => (
                  <SidebarItem
                    key={collection.id}
                    href={`/collections/${collection.id}`}
                    label={collection.name}
                    icon={Circle}
                    // Dot colored by the collection's most used item type.
                    iconClassName={cn('fill-current', textColorClass(collection.accentColor))}
                    count={collection.itemCount}
                  />
                ))}
              </>
            )}

            <SidebarViewAll href="/collections" label="View all collections" />
          </SidebarSection>
        </nav>
      </ScrollArea>

      {user && <SidebarUser user={user} />}
    </div>
  );
}
