import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDisplayName, getInitials } from '@/lib/user';
import type { CurrentUser } from '@/types/user';

interface UserAvatarProps {
  user: CurrentUser;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/**
 * The user's GitHub picture when they have one, their initials otherwise.
 * Radix renders the fallback on its own if the image 404s or is still loading.
 */
export function UserAvatar({ user, size = 'default', className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {user.image && <AvatarImage src={user.image} alt={getDisplayName(user)} />}
      <AvatarFallback>{getInitials(user)}</AvatarFallback>
    </Avatar>
  );
}
