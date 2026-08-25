import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * `session.user.id` is added by the session callback in `src/auth.ts`; the
   * default session type only covers name, email and image.
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
