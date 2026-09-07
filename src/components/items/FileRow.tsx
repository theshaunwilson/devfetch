import { Download, Pin, Star } from 'lucide-react';

import { OpenItemButton } from '@/components/items/OpenItemButton';
import { TypeIconTile } from '@/components/items/TypeIconTile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { borderColorClass } from '@/lib/colors';
import { getFileIcon } from '@/lib/file-icons';
import { formatShortDate } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { formatFileSize } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import type { DashboardItem } from '@/types/item';

interface FileRowProps {
  item: DashboardItem;
}

/**
 * One row in the `/items/file` list.
 *
 * A list rather than the grid every other non-image type uses: a file's name,
 * size and date are short values that line up down a column, and comparing
 * them across rows is the whole point of the view.
 *
 * Its own component rather than a branch inside `ItemCard`, for the same reason
 * `ImageCard` is: the shape differs. The description and tags are dropped —
 * they are a click away in the drawer, and they would push the metadata off
 * the line it exists to sit on.
 */
export function FileRow({ item }: FileRowProps) {
  const { type } = item;
  // A file item with no stored object is representable even though the create
  // dialog requires one, so fall back to the type's own icon rather than
  // implying a file that is not there.
  //
  // Passed to `TypeIconTile` rather than rendered here: a component assigned
  // during render trips `react-hooks/static-components`, and the tile takes it
  // as a prop for exactly that reason — the same call `ItemCard` makes.
  const icon = item.fileName ? getFileIcon(item.fileName) : getIcon(type.icon);

  return (
    <Card
      className={cn(
        'relative flex-row items-center gap-3 border-l-4 p-3 transition-colors hover:bg-muted/40 sm:gap-4 sm:p-4',
        borderColorClass(type.color)
      )}
    >
      <OpenItemButton item={item} />

      <TypeIconTile icon={icon} color={type.color} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* min-w-0 on the flex child is what lets `truncate` take effect;
              a flex item's min width is auto, so without it a long name grows
              to its content width and is clipped with no ellipsis. */}
          <p className="truncate text-sm font-medium" title={item.fileName ?? item.title}>
            {item.fileName ?? item.title}
          </p>
          {item.isPinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
          {item.isFavorite && (
            <Star className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
          )}
        </div>

        {/* Stacked below `sm`, where the two values would otherwise crowd the
            name and the download button off the row. */}
        <div className="mt-0.5 flex flex-col text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2">
          {item.fileSize !== null && <span>{formatFileSize(item.fileSize)}</span>}
          {item.fileSize !== null && <span aria-hidden className="hidden sm:inline">·</span>}
          <span>{formatShortDate(item.createdAt)}</span>
        </div>
      </div>

      {item.fileUrl && item.fileName && (
        // z-20 rather than a click handler that stops propagation: the row's
        // trigger is an `absolute inset-0` overlay at z-10, not a wrapper, so
        // there is no click to stop — the link simply has to sit above it.
        <Button asChild variant="outline" size="sm" className="relative z-20 shrink-0">
          {/* `?download` makes the route answer with an attachment
              disposition, which is what names the saved file. Never a bucket
              URL: uploads are private and read back through the proxy. */}
          <a href={`/api/files/${item.id}?download`} download={item.fileName}>
            <Download className="size-4" />
            <span className="sr-only sm:not-sr-only">Download</span>
          </a>
        </Button>
      )}
    </Card>
  );
}
