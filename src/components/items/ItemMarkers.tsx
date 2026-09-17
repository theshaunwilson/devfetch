import { Pin } from 'lucide-react';

/**
 * The pinned marker, shared by all four card shapes.
 *
 * It used to draw the favourited star too. That star is now a real toggle —
 * `FavoriteItemButton` — and a read-only indicator beside it would read as two
 * stars rather than as one piece of state, so only the pin is left here. Pinning
 * still has no mutation, so it stays an indicator; when it gets one this
 * component goes with it.
 */
export function ItemMarkers({ isPinned }: { isPinned: boolean }) {
  return isPinned ? <Pin className="size-3.5 shrink-0 text-muted-foreground" /> : null;
}
