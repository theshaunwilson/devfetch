import { Pin, Star, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { borderColorClass, softBgColorClass, textColorClass } from '@/lib/colors';
import { formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { itemTypes, type Item } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface ItemRowProps {
  item: Item;
}

/** Tinted tile holding the item type icon. */
function TypeIconTile({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg',
        softBgColorClass(color)
      )}
    >
      <Icon className={cn('size-4', textColorClass(color))} />
    </div>
  );
}

/** Item row used by the Pinned and Recent lists. */
export function ItemRow({ item }: ItemRowProps) {
  const type = itemTypes.find((itemType) => itemType.id === item.typeId);
  const color = type?.color ?? '';

  return (
    <Card className={cn('border-l-4', borderColorClass(color))}>
      <div className="flex items-start gap-3 px-(--card-spacing)">
        <TypeIconTile icon={getIcon(type?.icon ?? '')} color={color} />

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

          <p className="mt-1 truncate text-sm text-muted-foreground">{item.description}</p>

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
