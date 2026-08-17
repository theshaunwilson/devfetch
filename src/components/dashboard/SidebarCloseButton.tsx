'use client';

import { X } from 'lucide-react';
import { useSidebar } from '@/components/dashboard/SidebarProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Closes the mobile drawer from inside the sidebar header. */
export function SidebarCloseButton({ className }: { className?: string }) {
  const { closeMobile } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={closeMobile}
      aria-label="Close navigation"
      className={cn(className)}
    >
      <X className="size-4.5" />
    </Button>
  );
}
