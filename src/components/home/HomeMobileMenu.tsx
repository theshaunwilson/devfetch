'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { SIGN_IN_PATH } from '@/components/home/content';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HomeMobileMenuProps {
  /** A visitor with a session needs no sign-in row. */
  signedIn: boolean;
}

/**
 * The section links below `sm`, where they do not fit on the bar.
 *
 * The bar is `position: fixed`, so its overflow clips rather than scrolls —
 * anything that does not fit is unreachable rather than merely off to the
 * side. The links were simply hidden, which left a phone visitor no way to
 * reach Pricing, the page's conversion target, short of scrolling the whole
 * page. Sign in joins them here so the primary CTA can stay on the bar.
 */
export function HomeMobileMenu({ signedIn }: HomeMobileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 sm:hidden">
          <Menu className="size-5" aria-hidden="true" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href="#features">Features</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="#pricing">Pricing</Link>
        </DropdownMenuItem>
        {!signedIn && (
          <DropdownMenuItem asChild>
            <Link href={SIGN_IN_PATH}>Sign in</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
