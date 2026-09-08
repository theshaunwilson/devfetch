import { Pin, Star } from 'lucide-react';
import { OpenItemButton } from '@/components/items/OpenItemButton';
import { TypeIconTile } from '@/components/items/TypeIconTile';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { borderColorClass } from '@/lib/colors';
import { formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { DashboardItem } from '@/types/item';

interface ItemCardProps {
  item: DashboardItem;
}

/**
 * Item tile in the `/items/[type]` grid, bordered by its item type's color.
 * Clicking anywhere on it opens the detail drawer.
 */
export function ItemCard({ item }: ItemCardProps) {
  const { type } = item;
  // Both are optional, so an item with neither renders no body at all rather
  // than an empty padded block.
  const hasBody = Boolean(item.description) || item.tags.length > 0;

  return (
    <Card
      className={cn(
        'relative h-full border-l-4 transition-colors hover:bg-muted/40',
        borderColorClass(type.color)
      )}
    >
      <OpenItemButton item={item} />

      <CardHeader>
        {/* min-w-0 for the same reason the title below carries it, one level
            up: this row is a grid item of CardHeader, so its own min width is
            auto and a long title would grow the whole row past the card
            rather than shrinking to fit. */}
        <div className="flex min-w-0 items-start gap-3">
          <TypeIconTile icon={getIcon(type.icon)} color={type.color} />

          <div className="min-w-0 flex-1">
            {/* min-w-0 is what makes `truncate` below do anything: the title
                is a flex container in a grid item, both of which take a min
                width of auto, so without it a long title grows to its content
                width and is clipped by the card with no ellipsis. */}
            <CardTitle className="flex min-w-0 items-center gap-2">
              <span className="truncate">{item.title}</span>
              {item.isPinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
              {item.isFavorite && (
                <Star className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
              )}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(item.updatedAt)}</p>
          </div>
        </div>
      </CardHeader>

      {hasBody && (
        <CardContent className="flex flex-1 flex-col gap-4">
          {item.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
          )}

          {item.tags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
