import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

// Every page names only itself; the template adds the brand, so the format and
// the spelling live in one place.
export const metadata: Metadata = {
  title: { default: 'DevFetch', template: '%s · DevFetch' },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn('dark font-sans', geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
