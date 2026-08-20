'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { useSidebar } from '@/components/dashboard/SidebarProvider';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon */
  iconClassName?: string;
  /** Right aligned item count */
  count?: number;
  /** Right aligned adornment, used for the favorite star and the Pro badge */
  trailing?: React.ReactNode;
}

/** Single sidebar link row. Closes the drawer when navigating on mobile. */
export function SidebarItem({
  href,
  label,
  icon: Icon,
  iconClassName,
  count,
  trailing,
}: SidebarItemProps) {
  const pathname = usePathname();
  const { closeMobile } = useSidebar();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={closeMobile}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent',
        isActive && 'bg-accent font-medium'
      )}
    >
      <Icon className={cn('size-4 shrink-0', iconClassName ?? 'text-muted-foreground')} />
      <span className="truncate">{label}</span>

      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {trailing}
        {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
      </span>
    </Link>
  );
}
