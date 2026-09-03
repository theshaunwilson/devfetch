'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { sidebarCookie } from '@/lib/sidebar';

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

interface SidebarProviderProps {
  children: React.ReactNode;
  /**
   * The sidebar's state as the server read it from the cookie. Required, not
   * defaulted, so a new caller cannot silently render the wrong width and
   * reintroduce the hydration mismatch this exists to avoid.
   */
  defaultOpen: boolean;
}

export function SidebarProvider({ children, defaultOpen }: SidebarProviderProps) {
  const isMobile = useIsMobile();
  const [isOpen, setOpen] = useState(defaultOpen);
  const [isMobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    // The drawer is transient — it should never be open on arrival — so only
    // the desktop state is persisted.
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }

    const next = !isOpen;

    setOpen(next);
    // Written on the toggle rather than in an effect: the cookie records a
    // deliberate choice, not every render that happens to have a value.
    document.cookie = sidebarCookie(next);
  }, [isMobile, isOpen]);

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
