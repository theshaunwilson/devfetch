'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarContextValue {
  /** Desktop sidebar visibility */
  isOpen: boolean;
  /** Mobile drawer visibility */
  isMobileOpen: boolean;
  isMobile: boolean;
  setMobileOpen: (open: boolean) => void;
  /** Toggles the drawer on mobile, the sidebar on desktop */
  toggle: () => void;
  /** Closes the drawer after navigating on mobile */
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [isOpen, setOpen] = useState(true);
  const [isMobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((open) => !open);
    } else {
      setOpen((open) => !open);
    }
  }, [isMobile]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, isMobileOpen, isMobile, setMobileOpen, toggle, closeMobile }),
    [isOpen, isMobileOpen, isMobile, toggle, closeMobile]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
