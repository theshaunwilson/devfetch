import { Pin, Star } from 'lucide-react';
import { TypeIconTile } from '@/components/items/TypeIconTile';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { borderColorClass } from '@/lib/colors';
import { formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import type { DashboardItem } from '@/types/item';

interface ItemRowProps {
  item: DashboardItem;
}

/** Item row used by the Pinned and Recent lists. */
export function ItemRow({ item }: ItemRowProps) {
  const { type } = item;

  return (
    <Card className={cn('border-l-4', borderColorClass(type.color))}>
      <div className="flex items-start gap-3 px-(--card-spacing)">
        <TypeIconTile icon={getIcon(type.icon)} color={type.color} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{item.title}</h3>
            {item.isPinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
            {item.isFavorite && (
              <Star className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
            )}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatShortDate(item.updatedAt)}
            </span>
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
