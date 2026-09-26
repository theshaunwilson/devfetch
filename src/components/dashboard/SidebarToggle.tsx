'use client';

import { PanelLeft } from 'lucide-react';
import { useSidebar } from '@/components/dashboard/SidebarProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarToggleProps {
  className?: string;
  size?: 'icon' | 'icon-sm';
}

/** Opens and closes the sidebar (the drawer on mobile). */
export function SidebarToggle({ className, size = 'icon' }: SidebarToggleProps) {
  const { isOpen, isMobileOpen, isMobile, toggle } = useSidebar();
  const expanded = isMobile ? isMobileOpen : isOpen;

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggle}
      aria-expanded={expanded}
      aria-label={expanded ? 'Close sidebar' : 'Open sidebar'}
      // The ghost variant fills any `aria-expanded` button, which suits a menu
      // trigger whose menu is showing but made this one — expanded whenever
      // the sidebar is open, which is always — sit filled at rest and read as
      // the selected row beside the real one. Hover still fills it.
      className={cn(
        'aria-expanded:bg-transparent aria-expanded:text-inherit aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50',
        className
      )}
    >
      <PanelLeft className="size-4.5" />
    </Button>
  );
}
