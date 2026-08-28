/** The signed-in user as rendered in the sidebar's user area. */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

/**
 * The signed-in user as rendered on the profile page. Extends `CurrentUser`
 * so `UserAvatar` takes it unchanged.
 */
export interface ProfileUser extends CurrentUser {
  /** ISO string — the page formats it with `formatLongDate` */
  createdAt: string;
  /**
   * Whether the account can sign in with a password. Derived from
   * `User.password`, which must never itself reach the client — this is what
   * decides if the change-password form renders.
   */
  hasPassword: boolean;
}
