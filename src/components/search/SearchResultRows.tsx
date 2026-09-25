'use client';

import { Folder, type LucideIcon } from 'lucide-react';

import { CommandItem, CommandShortcut } from '@/components/ui/command';
import { textColorClass } from '@/lib/colors';
import { capitalize } from '@/lib/format';
import { getIcon } from '@/lib/icons';
import { buildCollectionKeywords, buildItemKeywords, collapseWhitespace } from '@/lib/search';
import { cn } from '@/lib/utils';
import type { CollectionOption } from '@/types/collection';
import type { SearchItem } from '@/types/search';

/**
 * Rows are matched on `keywords`, never on `value`: cmdk identifies a row by
 * `value` and it has to be unique, so it is the row's id — and a cuid matches
 * short queries by accident. The text worth searching rides in `keywords`.
 */

/** Takes the icon as a prop, as `TypeIconTile` does, so none is created during render. */
function RowIcon({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return <Icon className={className} />;
}

export function ItemResultRow({
  item,
  onSelect,
}: {
  item: SearchItem;
  onSelect: (item: SearchItem) => void;
}) {
  const preview = item.contentPreview ? collapseWhitespace(item.contentPreview) : null;

  return (
    <CommandItem value={item.id} keywords={buildItemKeywords(item)} onSelect={() => onSelect(item)}>
      <RowIcon
        icon={getIcon(item.type.icon)}
        className={cn('size-4', textColorClass(item.type.color))}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.title}</span>
        {preview && <span className="block truncate text-xs text-muted-foreground">{preview}</span>}
      </span>
      <CommandShortcut className="shrink-0">{capitalize(item.type.name)}</CommandShortcut>
    </CommandItem>
  );
}

export function CollectionResultRow({
  collection,
  onSelect,
}: {
  collection: CollectionOption;
  onSelect: (id: string) => void;
}) {
  return (
    <CommandItem
      value={collection.id}
      keywords={buildCollectionKeywords(collection)}
      onSelect={() => onSelect(collection.id)}
    >
      <Folder className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{collection.name}</span>
      <CommandShortcut className="shrink-0">
        {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
      </CommandShortcut>
    </CommandItem>
  );
}
