import type { Metadata } from 'next';
import { Geist, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

/*
 * Two display faces for the marketing homepage, self-hosted by `next/font`
 * rather than fetched from Google at runtime. They deliberately do not take
 * over `--font-sans` or `--font-mono`: the app's own typography is unchanged,
 * and only homepage components reach for `font-display` / `font-code`.
 */
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code' });

export const metadata: Metadata = {
  title: 'Devfetch',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={cn(
        'dark font-sans',
        geist.variable,
        spaceGrotesk.variable,
        jetBrainsMono.variable
      )}
    >
      <body>{children}</body>
    </html>
  );
}
