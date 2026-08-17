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
      className={cn(className)}
    >
      <PanelLeft className="size-4.5" />
    </Button>
  );
}
