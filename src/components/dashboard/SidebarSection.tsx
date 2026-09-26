'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
}

/** Collapsible group of sidebar links. */
export function SidebarSection({ title, children }: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 max-md:py-2.5 text-sm text-muted-foreground transition-colors hover:font-bold hover:text-foreground"
      >
        {title}
        <ChevronDown
          className={cn('size-4 transition-transform duration-200', !isOpen && '-rotate-90')}
        />
      </button>

      {isOpen && <div className="mt-1 flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}
