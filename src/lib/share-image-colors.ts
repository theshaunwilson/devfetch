/**
 * Colours for the generated share image (`src/app/opengraph-image.tsx`).
 *
 * The image is rendered by `next/og`, which cannot read CSS variables, so
 * these are copies of the dark-theme tokens in `src/app/globals.css`.
 * `palette.test.ts` fails if any copy drifts from the stylesheet.
 */
export const SHARE_IMAGE_COLORS = {
  background: '#090e0c', // --background
  card: '#101715', // --card
  border: '#24302b', // --border
  foreground: '#e5eee9', // --foreground
  muted: '#8ea198', // --muted-foreground
  primary: '#b6ee5c', // --primary
  brandAlt: '#7fdcff', // --brand-alt
  types: {
    snippet: '#7aa2ff', // --type-snippet
    prompt: '#e08cf5', // --type-prompt
    command: '#ffab5c', // --type-command
    note: '#efe1b0', // --type-note
    file: '#97a69f', // --type-file
    image: '#ff7e9b', // --type-image
    link: '#4fd8c2', // --type-link
  },
} as const;
