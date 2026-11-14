import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

// Every page names only itself; the template adds the brand, so the format and
// the spelling live in one place.
//
// The description and Open Graph fields are the defaults a shared link falls
// back to; `opengraph-image.tsx` beside this file supplies the image, and
// `metadataBase` is what makes its URL absolute. X reads the Open Graph tags
// too, so the only Twitter-specific field is the large card.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn('dark font-sans', geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
