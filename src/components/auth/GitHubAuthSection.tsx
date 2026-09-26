import { signInWithGitHub } from '@/actions/auth';
import { GitHubIcon } from '@/components/auth/GitHubIcon';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { Separator } from '@/components/ui/separator';

interface GitHubAuthSectionProps {
  /** Where to land after the OAuth round-trip; re-checked by `safeCallbackUrl`. */
  callbackUrl: string;
  label: string;
}

/**
 * The "or" divider and GitHub button, shared by `/sign-in` and `/register` so
 * both pages offer the same way in. One action serves both: GitHub OAuth
 * creates the account on a first visit and signs in on every later one.
 */
export function GitHubAuthSection({ callbackUrl, label }: GitHubAuthSectionProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground uppercase">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Its own form: a nested one is invalid, and this posts to a different action. */}
      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <SubmitButton variant="outline" pendingLabel="Redirecting…" className="w-full">
          <GitHubIcon className="size-4" />
          {label}
        </SubmitButton>
      </form>
    </>
  );
}
