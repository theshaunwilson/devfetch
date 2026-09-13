import Link from 'next/link';
import { Star } from 'lucide-react';
import { CollectionCardMenu } from '@/components/collections/CollectionCardMenu';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { borderColorClass, textColorClass } from '@/lib/colors';
import { getIcon } from '@/lib/icons';
import type { DashboardCollection } from '@/types/collection';
import { cn } from '@/lib/utils';

interface CollectionCardProps {
  collection: DashboardCollection;
}

/** Collection tile in the dashboard grid and on `/collections`. */
export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Card
      className={cn(
        'relative h-full border-l-4 transition-colors hover:bg-accent/40',
        borderColorClass(collection.accentColor)
      )}
    >
      {/* An overlay rather than a wrapper around the card: the actions menu is a
          button, and a button inside an anchor is invalid markup and would
          follow the link when clicked. This keeps the whole card navigating
          while leaving room for controls above it — the shape
          `OpenItemButton` established. */}
      <Link
        href={`/collections/${collection.id}`}
        // The card clips overflow, so an outset focus ring would be cut off.
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
      >
        <span className="sr-only">Open {collection.name}</span>
      </Link>

      <CardHeader>
        {/* `min-w-0` on the title: with a card action present the header is a
            two-column grid, and a grid item's own min width is `auto`, so
            without this a long name grows the column instead of truncating. */}
        <CardTitle className="flex min-w-0 items-center gap-2">
          <span className="truncate">{collection.name}</span>
          {collection.isFavorite && (
            <Star className="size-4 shrink-0 fill-yellow-500 text-yellow-500" />
          )}
        </CardTitle>
        <CardDescription>
          {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
        </CardDescription>

        <CardAction>
          <CollectionCardMenu
            collection={{
              id: collection.id,
              name: collection.name,
              description: collection.description,
            }}
            isFavorite={collection.isFavorite}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {collection.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{collection.description}</p>
        )}

        <div className="mt-auto flex items-center gap-2.5">
          {collection.types.map((type) => {
            const Icon = getIcon(type.icon);
            return (
              <Icon
                key={type.id}
                aria-label={type.name}
                className={cn('size-4', textColorClass(type.color))}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
