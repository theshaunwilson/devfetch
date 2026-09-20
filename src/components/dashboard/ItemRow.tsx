import { CopyItemButton } from '@/components/items/CopyItemButton';
import { FavoriteItemButton } from '@/components/items/FavoriteItemButton';
import { ItemMarkers } from '@/components/items/ItemMarkers';
import { OpenItemButton } from '@/components/items/OpenItemButton';
import { TypeIconTile } from '@/components/items/TypeIconTile';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { borderColorClass } from '@/lib/colors';
import { formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { copyableFieldFor } from '@/lib/items';
import { cn } from '@/lib/utils';
import type { DashboardItem } from '@/types/item';

interface ItemRowProps {
  item: DashboardItem;
}

/**
 * Item row used by the Pinned and Recent lists. Clicking anywhere on it opens
 * the detail drawer.
 */
export function ItemRow({ item }: ItemRowProps) {
  const { type } = item;
  // Null for a type whose body is not text — the dashboard's lists mix every
  // type, so file and image rows get no button.
  const copyableField = copyableFieldFor(type.slug);

  return (
    <Card
      className={cn(
        'relative border-l-4 transition-colors hover:bg-muted/40',
        borderColorClass(type.color)
      )}
    >
      <OpenItemButton item={item} />

      <div className="flex items-start gap-3 px-(--card-spacing)">
        <TypeIconTile icon={getIcon(type.icon)} color={type.color} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{item.title}</h3>
            <ItemMarkers isPinned={item.isPinned} />
            {/*
              Hidden below `sm`, where the line has a type tile, a title, a pin
              marker, two buttons and this to fit: measured at 375px the title
              was left 114px and clipped even at 16 characters. The drawer shows
              the date, so dropping it here costs the least.

              `<time>` with the ISO value, as `FavoriteRow` has it — the visible
              text carries no year, and nothing but the markup says this is the
              updated date rather than the created one.
            */}
            <time
              dateTime={item.updatedAt}
              className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:block"
            >
              <span className="sr-only">Updated </span>
              {formatShortDate(item.updatedAt)}
            </time>

            {/* On the title line rather than beside the block, so they line up
                with the date instead of floating over the description. One
                cluster, so the star keeps its own spacing on the rows that get
                no copy button — file and image items.

                `ml-auto` here as well: below `sm` the date is gone, so without
                it the buttons would sit against the title instead of the edge.
                `gap-1.5` below `sm` keeps two touch targets apart; above it
                they tighten back to the original spacing. */}
            <div className="-my-1 -mr-1 ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0 sm:gap-0.5">
              <FavoriteItemButton
                itemId={item.id}
                title={item.title}
                isFavorite={item.isFavorite}
              />

              {copyableField && (
                <CopyItemButton itemId={item.id} field={copyableField} title={item.title} />
              )}
            </div>
          </div>

          {item.description && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{item.description}</p>
          )}

          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
