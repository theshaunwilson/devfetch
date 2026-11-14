import { ImageResponse } from 'next/og';

import { SHARE_IMAGE_COLORS as C } from '@/lib/share-image-colors';
import { SITE_NAME, SITE_URL } from '@/lib/site';

/*
 * The card a link preview shows for every page (Slack, LinkedIn, X and the
 * rest). Generated at build from the root segment, so each route inherits it.
 *
 * `next/og` renders a subset of CSS: every element with more than one child
 * needs `display: flex`, and colours come from `SHARE_IMAGE_COLORS` because
 * CSS variables do not exist here. The font is the Geist that `next/og`
 * bundles, so the card uses the app's typeface without a network fetch.
 */

export const alt = 'DevFetch: one searchable hub for your snippets, prompts, commands, notes, files and links';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPES = [
  ['Snippets', C.types.snippet],
  ['Prompts', C.types.prompt],
  ['Commands', C.types.command],
  ['Notes', C.types.note],
  ['Files', C.types.file],
  ['Images', C.types.image],
  ['Links', C.types.link],
] as const;

function BrandMark() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="g" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor={C.primary} />
          <stop offset="1" stopColor={C.brandAlt} />
        </linearGradient>
      </defs>
      <g stroke="url(#g)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
        <path d="m3 12 9 4.5 9-4.5" />
        <path d="m3 16.5 9 4.5 9-4.5" />
      </g>
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: C.background,
          color: C.foreground,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <BrandMark />
            <span style={{ fontSize: 44, letterSpacing: -1 }}>{SITE_NAME}</span>
          </div>
          <span style={{ fontSize: 26, color: C.muted }}>{new URL(SITE_URL).host}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, lineHeight: 1.04, letterSpacing: -3 }}>
            <span>Stop losing your</span>
            <span
              style={{
                backgroundImage: `linear-gradient(90deg, ${C.primary}, ${C.brandAlt})`,
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              developer knowledge
            </span>
          </div>
          <span style={{ fontSize: 30, color: C.muted, maxWidth: 900, lineHeight: 1.4 }}>
            Snippets, prompts, commands, notes, files and links in one place you can actually search.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {TYPES.map(([label, colour]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 16px',
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                background: C.card,
                fontSize: 22,
                color: C.foreground,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 999, background: colour }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
