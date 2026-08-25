import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormMessageProps {
  children: React.ReactNode;
  variant?: 'error' | 'success';
}

/** Form-level banner. Field-level messages render under their own input. */
export function FormMessage({ children, variant = 'error' }: FormMessageProps) {
  const Icon = variant === 'error' ? CircleAlert : CircleCheck;

  return (
    <p
      // Errors are announced; the success banner is followed by a navigation.
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        variant === 'error'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted text-muted-foreground'
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
