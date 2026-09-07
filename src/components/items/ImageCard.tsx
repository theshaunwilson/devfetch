import { Pin, Star } from 'lucide-react';
import { OpenItemButton } from '@/components/items/OpenItemButton';
import { TypeIconTile } from '@/components/items/TypeIconTile';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { borderColorClass } from '@/lib/colors';
import { formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { DashboardItem } from '@/types/item';

interface ImageCardProps {
  item: DashboardItem;
}

/**
 * Gallery tile for an image item: the picture itself, then its title and date.
 *
 * A separate component rather than a branch inside `ItemCard`, because the two
 * are different shapes — this one leads with the image and drops the
 * description and tags, which would push the pictures apart and are a click
 * away in the drawer. Everything else is deliberately the same: the type's
 * left border, the pin and favourite markers, and the overlay button that
 * opens the drawer.
 */
export function ImageCard({ item }: ImageCardProps) {
  const { type } = item;

  return (
    <Card
      className={cn(
        // pt-0 so the thumbnail sits flush against the top edge; the card's own
        // overflow-hidden is what rounds it.
        'relative h-full gap-3 border-l-4 pt-0 transition-colors hover:bg-muted/40',
        borderColorClass(type.color)
      )}
    >
      <OpenItemButton item={item} />

      {/* Clips the zoom, so hovering scales the picture inside the card
          rather than growing the card. */}
      <div className="overflow-hidden bg-muted/40">
        {item.fileUrl ? (
          // Not `next/image`: the optimizer would have to fetch the object
          // itself, and it has no session to be allowed to.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${item.id}`}
            alt={item.title}
            // Every thumbnail is a proxied request, so a long gallery should
            // not issue all of them at once.
            loading="lazy"
            className={cn(
              'aspect-video w-full object-cover',
              // `group/card` is the Card's own group, so the zoom follows a
              // hover anywhere on the tile.
              'transition-transform duration-300 group-hover/card:scale-105'
            )}
          />
        ) : (
          // An image item with no object is representable even though the
          // create dialog requires one, so it gets the type's icon rather than
          // a broken picture.
          <div className="flex aspect-video w-full items-center justify-center">
            <TypeIconTile icon={getIcon(type.icon)} color={type.color} />
          </div>
        )}
      </div>

      <CardHeader>
        {/* min-w-0 is what makes `truncate` below do anything: CardTitle is a
            grid item of CardHeader, and a grid item's min-width is auto, so
            without it the title grows to its content width and is clipped by
            the card with no ellipsis rather than shrinking to fit. */}
        <CardTitle className="flex min-w-0 items-center gap-2">
          <span className="truncate">{item.title}</span>
          {item.isPinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
          {item.isFavorite && (
            <Star className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
          )}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(item.updatedAt)}</p>
      </CardHeader>
    </Card>
  );
}
