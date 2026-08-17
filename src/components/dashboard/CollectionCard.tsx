import Link from 'next/link';
import { Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { borderColorClass, textColorClass } from '@/lib/colors';
import { getIcon } from '@/lib/icons';
import { itemTypes, type Collection } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface CollectionCardProps {
  collection: Collection;
}

/** Collection tile in the dashboard grid. */
export function CollectionCard({ collection }: CollectionCardProps) {
  const types = collection.itemTypeIds
    .map((typeId) => itemTypes.find((type) => type.id === typeId))
    .filter((type) => type !== undefined);

  return (
    <Link href={`/collections/${collection.id}`} className="block">
      <Card
        className={cn(
          'h-full border-l-4 transition-colors hover:bg-accent/40',
          borderColorClass(collection.color)
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="truncate">{collection.name}</span>
            {collection.isFavorite && (
              <Star className="size-4 shrink-0 fill-yellow-500 text-yellow-500" />
            )}
          </CardTitle>
          <CardDescription>{collection.itemCount} items</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-between gap-4">
          <p className="line-clamp-2 text-sm text-muted-foreground">{collection.description}</p>

          <div className="flex items-center gap-2.5">
            {types.map((type) => {
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
    </Link>
  );
}
