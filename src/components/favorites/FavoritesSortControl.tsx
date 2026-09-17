'use client';

import { ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FAVORITE_SORT_OPTIONS,
  type FavoriteSort,
  type FavoriteSortKey,
} from '@/lib/favorites-sort';

interface FavoritesSortControlProps {
  sort: FavoriteSort;
  onChange: (sort: FavoriteSort) => void;
}

/**
 * The key picker and the direction toggle, as one control.
 *
 * `Select` rather than a `DropdownMenu`: a short list of mutually exclusive
 * options showing which one is active is what it is for, and it is the idiom
 * the editor preferences already use. Both were already in
 * `src/components/ui/`, so nothing needed generating — `shadcn add` has pulled
 * a third-party `cn` package on four previous occasions.
 */
export function FavoritesSortControl({ sort, onChange }: FavoritesSortControlProps) {
  const isDescending = sort.direction === 'desc';
  const DirectionIcon = isDescending ? ArrowDownWideNarrow : ArrowUpNarrowWide;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Select
        value={sort.key}
        onValueChange={(key) => onChange({ ...sort, key: key as FavoriteSortKey })}
      >
        {/* The icon is what says this is a sort rather than a filter: the
            trigger otherwise shows only the key's name, which on its own reads
            as a label for something unstated. */}
        <SelectTrigger aria-label="Sort by" className="w-36">
          <ArrowUpDown className="size-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FAVORITE_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange({ ...sort, direction: isDescending ? 'asc' : 'desc' })}
        // A toggle button with a stable name, the treatment `FavoriteItemButton`
        // uses: the pressed state is what announces the current direction, so
        // the name stays the same thing it was before the click. A label that
        // flipped between "Sort ascending" and "Sort descending" would name the
        // action but never say which way the list is currently sorted.
        aria-pressed={isDescending}
        aria-label="Descending order"
      >
        <DirectionIcon className="size-4" />
      </Button>
    </div>
  );
}
