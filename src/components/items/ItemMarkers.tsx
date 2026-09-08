import { Pin, Star } from 'lucide-react';

/**
 * The pinned and favourited markers, shared by all four card shapes.
 *
 * The cards themselves are deliberately different components — a gallery
 * thumbnail and a file row are not the same thing — but this fragment is not
 * part of what differs, and pin and favourite mutations are still unbuilt, so
 * it would otherwise need changing in four places when they land.
 */
export function ItemMarkers({ isPinned, isFavorite }: { isPinned: boolean; isFavorite: boolean }) {
  return (
    <>
      {isPinned && <Pin className="size-3.5 shrink-0 text-muted-foreground" />}
      {isFavorite && <Star className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500" />}
    </>
  );
}
