/**
 * Seeds the development database with a demo user and sample content.
 *
 * Re-runnable: the demo user is deleted first, which cascades to their items,
 * collections and tags. System item types are global (userId null) so they are
 * matched on slug and updated in place instead.
 *
 * Run with: npm run db:seed
 */
import { config as loadEnv } from 'dotenv';
import bcrypt from 'bcryptjs';

// Prisma 7 no longer loads .env files itself.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const DEMO_EMAIL = 'demo@devfetch.io';
const DEMO_PASSWORD = '12345678';
const BCRYPT_ROUNDS = 12;

interface SeedItemType {
  name: string;
  slug: string;
  icon: string;
  color: string;
}

const SYSTEM_ITEM_TYPES: SeedItemType[] = [
  { name: 'snippet', slug: 'snippet', icon: 'Code', color: '#3b82f6' },
  { name: 'prompt', slug: 'prompt', icon: 'Sparkles', color: '#8b5cf6' },
  { name: 'command', slug: 'command', icon: 'Terminal', color: '#f97316' },
  { name: 'note', slug: 'note', icon: 'StickyNote', color: '#fde047' },
  { name: 'file', slug: 'file', icon: 'File', color: '#6b7280' },
  { name: 'image', slug: 'image', icon: 'Image', color: '#ec4899' },
  { name: 'link', slug: 'link', icon: 'Link', color: '#10b981' },
];

interface SeedItem {
  title: string;
  description: string;
  type: string;
  content?: string;
  url?: string;
  language?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  tags: string[];
}

interface SeedCollection {
  name: string;
  description: string;
  color: string;
  isFavorite?: boolean;
  items: SeedItem[];
}

const COLLECTIONS: SeedCollection[] = [
  {
    name: 'React Patterns',
    description: 'Reusable React patterns and hooks',
    color: '#3b82f6',
    isFavorite: true,
    items: [
      {
        title: 'useDebounce Hook',
        description: 'Delays a rapidly changing value until it settles',
        type: 'snippet',
        language: 'typescript',
        isFavorite: true,
        isPinned: true,
        tags: ['react', 'hooks', 'typescript'],
        content: `import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`,
      },
      {
        title: 'Theme Context Provider',
        description: 'Context provider with a typed hook that guards against missing providers',
        type: 'snippet',
        language: 'typescript',
        tags: ['react', 'context', 'patterns'],
        content: `'use client';

import { createContext, useContext, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const value = useMemo(
    () => ({
      theme,
      toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}`,
      },
      {
        title: 'Format Bytes Utility',
        description: 'Turns a byte count into a human readable file size',
        type: 'snippet',
        language: 'typescript',
        tags: ['typescript', 'utils'],
        content: `const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );

  return \`\${(bytes / 1024 ** exponent).toFixed(decimals)} \${UNITS[exponent]}\`;
}`,
      },
    ],
  },
  {
    name: 'AI Workflows',
    description: 'AI prompts and workflow automations',
    color: '#8b5cf6',
    items: [
      {
        title: 'Pull Request Review',
        description: 'Reviews a diff for correctness, security and performance',
        type: 'prompt',
        isFavorite: true,
        isPinned: true,
        tags: ['ai', 'review', 'quality'],
        content: `You are reviewing a pull request diff.

Report only issues you can point to a specific line for. For each one give:
1. The file and line
2. The concrete failure — inputs or state that produce the wrong result
3. A minimal fix

Order findings by severity. Cover correctness, security and performance in
that order. If the diff is clean, say so rather than inventing nitpicks.`,
      },
      {
        title: 'Generate Documentation',
        description: 'Writes reference docs for a module from its source',
        type: 'prompt',
        tags: ['ai', 'docs'],
        content: `Write reference documentation for the module below.

Include: what it is for, every exported function with parameters, return
value and thrown errors, and one realistic usage example per export.

Document the behaviour that is actually in the code — do not describe
intentions the implementation does not support. Note edge cases the caller
has to handle.`,
      },
      {
        title: 'Refactoring Assistant',
        description: 'Proposes a behaviour-preserving refactor with staged steps',
        type: 'prompt',
        tags: ['ai', 'refactor'],
        content: `Refactor the code below without changing its observable behaviour.

Work in stages, smallest first, and after each stage state what a test would
have to check to prove nothing broke. Call out any change that is not
strictly behaviour-preserving before making it.

Keep the existing naming and idioms unless they are the thing being fixed.`,
      },
    ],
  },
  {
    name: 'DevOps',
    description: 'Infrastructure and deployment resources',
    color: '#f97316',
    items: [
      {
        title: 'Multi-stage Next.js Dockerfile',
        description: 'Standalone output build that ships without dev dependencies',
        type: 'snippet',
        language: 'dockerfile',
        tags: ['docker', 'nextjs', 'deployment'],
        content: `FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]`,
      },
      {
        title: 'Deploy With Migrations',
        description: 'Applies pending migrations before starting the app',
        type: 'command',
        language: 'bash',
        tags: ['deployment', 'prisma'],
        content: 'npx prisma migrate deploy && npm run build && npm run start',
      },
      {
        title: 'Docker Documentation',
        description: 'Official reference for Dockerfiles, Compose and the CLI',
        type: 'link',
        url: 'https://docs.docker.com',
        tags: ['docker', 'docs'],
      },
      {
        title: 'GitHub Actions Documentation',
        description: 'Workflow syntax, runners and reusable actions',
        type: 'link',
        url: 'https://docs.github.com/en/actions',
        tags: ['ci', 'docs'],
      },
    ],
  },
  {
    name: 'Terminal Commands',
    description: 'Useful shell commands for everyday development',
    color: '#10b981',
    isFavorite: true,
    items: [
      {
        title: 'Undo Last Commit, Keep Changes',
        description: 'Drops the commit but leaves the work staged',
        type: 'command',
        language: 'bash',
        isFavorite: true,
        tags: ['git'],
        content: 'git reset --soft HEAD~1',
      },
      {
        title: 'Reclaim Docker Disk Space',
        description: 'Removes unused containers, images and volumes',
        type: 'command',
        language: 'bash',
        tags: ['docker', 'cleanup'],
        content: 'docker system prune -a --volumes',
      },
      {
        title: 'Kill Process On A Port',
        description: 'Frees a port still held by a crashed dev server',
        type: 'command',
        language: 'bash',
        isPinned: true,
        tags: ['process', 'debugging'],
        content: 'lsof -ti :3000 | xargs kill -9',
      },
      {
        title: 'Audit Outdated Packages',
        description: 'Lists dependencies behind their latest release',
        type: 'command',
        language: 'bash',
        tags: ['npm', 'dependencies'],
        content: 'npm outdated --long',
      },
    ],
  },
  {
    name: 'Design Resources',
    description: 'UI/UX resources and references',
    color: '#ec4899',
    items: [
      {
        title: 'Tailwind CSS Documentation',
        description: 'Utility class reference and theme configuration',
        type: 'link',
        url: 'https://tailwindcss.com/docs',
        isFavorite: true,
        tags: ['css', 'tailwind', 'docs'],
      },
      {
        title: 'shadcn/ui',
        description: 'Accessible components you copy into your own codebase',
        type: 'link',
        url: 'https://ui.shadcn.com',
        isFavorite: true,
        tags: ['components', 'react'],
      },
      {
        title: 'Material Design 3',
        description: 'Google design system covering tokens, layout and motion',
        type: 'link',
        url: 'https://m3.material.io',
        tags: ['design-system'],
      },
      {
        title: 'Lucide Icons',
        description: 'Open source icon set used throughout DevFetch',
        type: 'link',
        url: 'https://lucide.dev/icons',
        tags: ['icons'],
      },
    ],
  },
];

type PrismaClientInstance = Awaited<typeof import('../src/lib/prisma')>['prisma'];

/**
 * System types are global (userId null). Postgres treats NULLs as distinct, so
 * the @@unique([userId, slug]) constraint cannot dedupe them via upsert —
 * match on slug explicitly instead.
 */
async function seedSystemItemTypes(prisma: PrismaClientInstance) {
  const typeIdsBySlug = new Map<string, string>();

  for (const type of SYSTEM_ITEM_TYPES) {
    const existing = await prisma.itemType.findFirst({
      where: { slug: type.slug, userId: null },
    });

    const record = existing
      ? await prisma.itemType.update({
          where: { id: existing.id },
          data: { ...type, isSystem: true },
        })
      : await prisma.itemType.create({
          data: { ...type, isSystem: true },
        });

    typeIdsBySlug.set(type.slug, record.id);
  }

  return typeIdsBySlug;
}

async function seedTags(prisma: PrismaClientInstance, userId: string) {
  const names = [...new Set(COLLECTIONS.flatMap((c) => c.items.flatMap((i) => i.tags)))].sort();

  const tags = await Promise.all(
    names.map((name) => prisma.tag.create({ data: { name, userId } })),
  );

  return new Map(tags.map((tag) => [tag.name, tag.id]));
}

async function seedCollections(
  prisma: PrismaClientInstance,
  userId: string,
  typeIdsBySlug: Map<string, string>,
  tagIdsByName: Map<string, string>,
) {
  let itemCount = 0;

  for (const collection of COLLECTIONS) {
    const { items, ...fields } = collection;
    const record = await prisma.collection.create({ data: { ...fields, userId } });

    for (const item of items) {
      const { type, tags, ...itemFields } = item;
      const typeId = typeIdsBySlug.get(type);
      if (!typeId) throw new Error(`Unknown item type "${type}" on "${item.title}"`);

      await prisma.item.create({
        data: {
          ...itemFields,
          userId,
          typeId,
          // One collection per seeded item, as before items became a
          // many-to-many relation: the fixture's shape is what the dashboard
          // and `db:test` expectations are written against.
          collections: { create: [{ collectionId: record.id }] },
          tags: {
            create: tags.map((name) => ({ tagId: tagIdsByName.get(name)! })),
          },
        },
      });
      itemCount += 1;
    }
  }

  return itemCount;
}

async function main() {
  // Imported dynamically because src/lib/prisma reads DATABASE_URL at import
  // time, which has to happen after the dotenv calls above.
  const { prisma } = await import('../src/lib/prisma');

  try {
    // Cascades to the demo user's items, collections, tags and join rows,
    // which is what makes this script re-runnable.
    const { count } = await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
    if (count > 0) console.log('Removed the previous demo user');

    const typeIdsBySlug = await seedSystemItemTypes(prisma);
    console.log(`Item types:  ${typeIdsBySlug.size}`);

    const user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        name: 'Demo User',
        password: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS),
        isPro: false,
        emailVerified: new Date(),
      },
    });
    console.log(`User:        ${user.email}`);

    const tagIdsByName = await seedTags(prisma, user.id);
    console.log(`Tags:        ${tagIdsByName.size}`);

    const itemCount = await seedCollections(prisma, user.id, typeIdsBySlug, tagIdsByName);
    console.log(`Collections: ${COLLECTIONS.length}`);
    console.log(`Items:       ${itemCount}`);

    console.log('\nSeed complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('\nSeed failed:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
