'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FAVORITES_PATH = '/favorites';

/**
 * The top bar's star. Its own client component only so it can read the
 * pathname: on `/favorites` it takes the same accent background and
 * `aria-current` the sidebar's active row does, and the star fills, so the bar
 * says where you are rather than looking the same on every page.
 */
export function TopbarFavoritesLink() {
  const isActive = usePathname() === FAVORITES_PATH;

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn('size-10', isActive && 'bg-accent text-accent-foreground')}
    >
      <Link href={FAVORITES_PATH} aria-current={isActive ? 'page' : undefined}>
        <Star className={cn('size-4', isActive && 'fill-yellow-500 text-yellow-500')} />
        <span className="sr-only">Favorites</span>
      </Link>
    </Button>
  );
}
