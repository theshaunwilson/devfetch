import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** An item's tags as badges, wrapping onto as many lines as they need. */
export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  );
}
