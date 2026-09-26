import { CopyItemButton } from '@/components/items/CopyItemButton';
import { FavoriteItemButton } from '@/components/items/FavoriteItemButton';
import { ItemMarkers } from '@/components/items/ItemMarkers';
import { OpenItemButton } from '@/components/items/OpenItemButton';
import { TypeIconTile } from '@/components/items/TypeIconTile';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { borderColorClass } from '@/lib/colors';
import { formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { copyableFieldFor } from '@/lib/items';
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
  // Null for a type whose body is not text — no button rather than one that
  // could only report having nothing to copy.
  const copyableField = copyableFieldFor(type.slug);

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
            auto and a long title would grow the whole row past the card —
            taking the copy button with it — rather than shrinking to fit. */}
        <div className="flex min-w-0 items-start gap-3">
          <TypeIconTile icon={getIcon(type.icon)} color={type.color} />

          <div className="min-w-0 flex-1">
            {/* Two lines before the ellipsis, not one. The type tile and the
                favorite and copy buttons share this row, which on a phone or a
                three-column grid leaves the title ~130px — a single line cut
                most titles to a word or two.

                min-w-0 is what lets the clamp take effect at all: the title is
                a flex container in a grid item, both of which take a min width
                of auto, so without it a long title grows to its content width
                and is clipped by the card. */}
            <CardTitle className="flex min-w-0 items-start gap-2">
              <span className="line-clamp-2 wrap-break-word">{item.title}</span>
              <ItemMarkers isPinned={item.isPinned} />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(item.updatedAt)}</p>
          </div>

          {/* One cluster at `gap-0.5`: the row's own `gap-3` is spacing between
              the card's parts, and two icon buttons that far apart read as two
              unrelated controls rather than as this item's actions. */}
          <div className="flex shrink-0 items-center gap-0.5">
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
