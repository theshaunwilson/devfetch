/** The signed-in user as rendered in the sidebar's user area. */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}
