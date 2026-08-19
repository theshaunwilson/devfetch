'use client';

import Link from 'next/link';
import { useSidebar } from '@/components/dashboard/SidebarProvider';

interface SidebarViewAllProps {
  href: string;
  label: string;
}

/** Plain "View all" row closing a sidebar list. Closes the drawer on mobile. */
export function SidebarViewAll({ href, label }: SidebarViewAllProps) {
  const { closeMobile } = useSidebar();

  return (
    <Link
      href={href}
      onClick={closeMobile}
      className="mt-1 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {label}
    </Link>
  );
}
