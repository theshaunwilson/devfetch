import { CopyItemButton } from '@/components/items/CopyItemButton';
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
            <ItemMarkers isPinned={item.isPinned} isFavorite={item.isFavorite} />
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatShortDate(item.updatedAt)}
            </span>

            {/* On the title line rather than beside the block, so it lines up
                with the date instead of floating over the description. */}
            {copyableField && (
              <CopyItemButton
                itemId={item.id}
                field={copyableField}
                title={item.title}
                className="-my-1 -mr-1"
              />
            )}
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
