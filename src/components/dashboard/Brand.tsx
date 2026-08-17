import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

/** DevFetch mark and wordmark. The wordmark drops on the narrowest screens. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Layers className="size-4.5" />
      </span>
      <span className="hidden text-lg font-semibold tracking-tight sm:inline">DevFetch</span>
    </div>
  );
}
