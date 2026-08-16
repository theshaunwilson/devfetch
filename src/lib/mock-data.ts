/**
 * Temporary mock data for the dashboard UI.
 * Replaced by Prisma queries once the database is in place.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isPro: boolean;
}

export interface ItemType {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  isSystem: boolean;
  itemCount: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
  isFavorite: boolean;
  itemCount: number;
  /** Type ids shown as icons on the collection card */
  itemTypeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  contentType: 'text' | 'file';
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  url: string | null;
  language: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  typeId: string;
  collectionId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const currentUser: User = {
  id: 'user_1',
  name: 'John Doe',
  email: 'demo@devfetch.io',
  image: null,
  isPro: true,
};

export const itemTypes: ItemType[] = [
  {
    id: 'type_snippet',
    name: 'Snippets',
    slug: 'snippets',
    icon: 'Code2',
    color: '#3b82f6',
    isSystem: true,
    itemCount: 24,
  },
  {
    id: 'type_prompt',
    name: 'Prompts',
    slug: 'prompts',
    icon: 'Sparkles',
    color: '#a855f7',
    isSystem: true,
    itemCount: 18,
  },
  {
    id: 'type_command',
    name: 'Commands',
    slug: 'commands',
    icon: 'SquareTerminal',
    color: '#f97316',
    isSystem: true,
    itemCount: 15,
  },
  {
    id: 'type_note',
    name: 'Notes',
    slug: 'notes',
    icon: 'FileText',
    color: '#eab308',
    isSystem: true,
    itemCount: 12,
  },
  {
    id: 'type_file',
    name: 'Files',
    slug: 'files',
    icon: 'File',
    color: '#94a3b8',
    isSystem: true,
    itemCount: 5,
  },
  {
    id: 'type_image',
    name: 'Images',
    slug: 'images',
    icon: 'Image',
    color: '#ec4899',
    isSystem: true,
    itemCount: 3,
  },
  {
    id: 'type_url',
    name: 'Links',
    slug: 'links',
    icon: 'Link',
    color: '#22c55e',
    isSystem: true,
    itemCount: 8,
  },
];

export const collections: Collection[] = [
  {
    id: 'col_react_patterns',
    name: 'React Patterns',
    description: 'Common React patterns and hooks',
    color: '#3b82f6',
    isFavorite: true,
    itemCount: 12,
    itemTypeIds: ['type_snippet', 'type_note', 'type_url'],
    createdAt: '2024-01-02T10:00:00.000Z',
    updatedAt: '2024-01-15T09:30:00.000Z',
  },
  {
    id: 'col_python_snippets',
    name: 'Python Snippets',
    description: 'Useful Python code snippets',
    color: '#38bdf8',
    isFavorite: false,
    itemCount: 8,
    itemTypeIds: ['type_snippet', 'type_note'],
    createdAt: '2024-01-03T11:15:00.000Z',
    updatedAt: '2024-01-11T14:20:00.000Z',
  },
  {
    id: 'col_context_files',
    name: 'Context Files',
    description: 'AI context files for projects',
    color: '#e2e8f0',
    isFavorite: true,
    itemCount: 5,
    itemTypeIds: ['type_file', 'type_note'],
    createdAt: '2024-01-04T08:45:00.000Z',
    updatedAt: '2024-01-14T16:05:00.000Z',
  },
  {
    id: 'col_interview_prep',
    name: 'Interview Prep',
    description: 'Technical interview preparation',
    color: '#eab308',
    isFavorite: false,
    itemCount: 24,
    itemTypeIds: ['type_note', 'type_snippet', 'type_url', 'type_prompt'],
    createdAt: '2024-01-05T13:00:00.000Z',
    updatedAt: '2024-01-13T10:10:00.000Z',
  },
  {
    id: 'col_git_commands',
    name: 'Git Commands',
    description: 'Frequently used git commands',
    color: '#f97316',
    isFavorite: true,
    itemCount: 15,
    itemTypeIds: ['type_command', 'type_note'],
    createdAt: '2024-01-06T09:20:00.000Z',
    updatedAt: '2024-01-12T18:40:00.000Z',
  },
  {
    id: 'col_ai_prompts',
    name: 'AI Prompts',
    description: 'Curated AI prompts for coding',
    color: '#a855f7',
    isFavorite: false,
    itemCount: 18,
    itemTypeIds: ['type_prompt', 'type_snippet', 'type_note'],
    createdAt: '2024-01-07T15:30:00.000Z',
    updatedAt: '2024-01-15T12:00:00.000Z',
  },
];

export const items: Item[] = [
  {
    id: 'item_use_auth_hook',
    title: 'useAuth Hook',
    description: 'Custom authentication hook for React applications',
    contentType: 'text',
    content: `import { useContext } from 'react'
import { AuthContext } from './AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}`,
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: 'typescript',
    isFavorite: true,
    isPinned: true,
    typeId: 'type_snippet',
    collectionId: 'col_react_patterns',
    tags: ['react', 'auth', 'hooks'],
    createdAt: '2024-01-15T09:30:00.000Z',
    updatedAt: '2024-01-15T09:30:00.000Z',
  },
  {
    id: 'item_api_error_handling',
    title: 'API Error Handling Pattern',
    description: 'Fetch wrapper with exponential backoff retry logic',
    contentType: 'text',
    content: `export async function fetchWithRetry(url: string, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    await new Promise((r) => setTimeout(r, 2 ** attempt * 200))
  }
  throw new Error('Request failed after retries')
}`,
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: 'typescript',
    isFavorite: false,
    isPinned: true,
    typeId: 'type_snippet',
    collectionId: 'col_react_patterns',
    tags: ['api', 'fetch', 'error-handling'],
    createdAt: '2024-01-12T11:05:00.000Z',
    updatedAt: '2024-01-12T11:05:00.000Z',
  },
  {
    id: 'item_code_review_prompt',
    title: 'Code Review Prompt',
    description: 'Ask AI for a focused review of a pull request diff',
    contentType: 'text',
    content:
      'Review the following diff for correctness, security and performance issues. List findings by severity and suggest a concrete fix for each.',
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: null,
    isFavorite: true,
    isPinned: true,
    typeId: 'type_prompt',
    collectionId: 'col_ai_prompts',
    tags: ['ai', 'review', 'quality'],
    createdAt: '2024-01-14T16:45:00.000Z',
    updatedAt: '2024-01-14T16:45:00.000Z',
  },
  {
    id: 'item_git_undo_commit',
    title: 'Undo Last Commit',
    description: 'Keep the changes staged but drop the commit',
    contentType: 'text',
    content: 'git reset --soft HEAD~1',
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: 'bash',
    isFavorite: true,
    isPinned: false,
    typeId: 'type_command',
    collectionId: 'col_git_commands',
    tags: ['git', 'reset'],
    createdAt: '2024-01-11T08:10:00.000Z',
    updatedAt: '2024-01-11T08:10:00.000Z',
  },
  {
    id: 'item_git_prune_branches',
    title: 'Prune Merged Branches',
    description: 'Delete local branches already merged into main',
    contentType: 'text',
    content: 'git branch --merged main | grep -v main | xargs git branch -d',
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: 'bash',
    isFavorite: false,
    isPinned: false,
    typeId: 'type_command',
    collectionId: 'col_git_commands',
    tags: ['git', 'cleanup'],
    createdAt: '2024-01-10T17:25:00.000Z',
    updatedAt: '2024-01-10T17:25:00.000Z',
  },
  {
    id: 'item_python_dedupe',
    title: 'Dedupe a List Preserving Order',
    description: 'Remove duplicates from a Python list without sorting',
    contentType: 'text',
    content: `def dedupe(items):
    seen = set()
    return [x for x in items if not (x in seen or seen.add(x))]`,
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: 'python',
    isFavorite: false,
    isPinned: false,
    typeId: 'type_snippet',
    collectionId: 'col_python_snippets',
    tags: ['python', 'lists'],
    createdAt: '2024-01-09T12:00:00.000Z',
    updatedAt: '2024-01-09T12:00:00.000Z',
  },
  {
    id: 'item_system_design_notes',
    title: 'System Design Notes',
    description: 'Caching, sharding and rate limiting cheat sheet',
    contentType: 'text',
    content:
      '## Caching\n- Cache aside is the default\n- Always set a TTL\n\n## Rate Limiting\n- Token bucket for bursty traffic\n- Sliding window for strict quotas',
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: null,
    isFavorite: false,
    isPinned: false,
    typeId: 'type_note',
    collectionId: 'col_interview_prep',
    tags: ['system-design', 'interview'],
    createdAt: '2024-01-08T19:35:00.000Z',
    updatedAt: '2024-01-13T10:10:00.000Z',
  },
  {
    id: 'item_next_docs_link',
    title: 'Next.js App Router Docs',
    description: 'Official reference for routing, layouts and server actions',
    contentType: 'text',
    content: null,
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: 'https://nextjs.org/docs/app',
    language: null,
    isFavorite: true,
    isPinned: false,
    typeId: 'type_url',
    collectionId: 'col_react_patterns',
    tags: ['nextjs', 'docs'],
    createdAt: '2024-01-07T14:50:00.000Z',
    updatedAt: '2024-01-07T14:50:00.000Z',
  },
  {
    id: 'item_project_context_file',
    title: 'Project Context File',
    description: 'Base context handed to the AI assistant on every session',
    contentType: 'file',
    content: null,
    fileUrl: 'https://files.devfetch.dev/mock/project-context.md',
    fileName: 'project-context.md',
    fileSize: 8420,
    url: null,
    language: null,
    isFavorite: false,
    isPinned: false,
    typeId: 'type_file',
    collectionId: 'col_context_files',
    tags: ['ai', 'context'],
    createdAt: '2024-01-06T10:05:00.000Z',
    updatedAt: '2024-01-14T16:05:00.000Z',
  },
  {
    id: 'item_architecture_diagram',
    title: 'Architecture Diagram',
    description: 'High level diagram of the API and storage layers',
    contentType: 'file',
    content: null,
    fileUrl: 'https://files.devfetch.dev/mock/architecture.png',
    fileName: 'architecture.png',
    fileSize: 245760,
    url: null,
    language: null,
    isFavorite: false,
    isPinned: false,
    typeId: 'type_image',
    collectionId: null,
    tags: ['architecture', 'diagram'],
    createdAt: '2024-01-05T09:15:00.000Z',
    updatedAt: '2024-01-05T09:15:00.000Z',
  },
  {
    id: 'item_refactor_prompt',
    title: 'Refactor to Server Components',
    description: 'Prompt for converting client components to server components',
    contentType: 'text',
    content:
      'Convert this React component to a Next.js server component. Move interactivity into the smallest possible client child and explain each change.',
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: null,
    isFavorite: false,
    isPinned: false,
    typeId: 'type_prompt',
    collectionId: 'col_ai_prompts',
    tags: ['nextjs', 'refactor', 'ai'],
    createdAt: '2024-01-04T13:40:00.000Z',
    updatedAt: '2024-01-04T13:40:00.000Z',
  },
  {
    id: 'item_docker_prune',
    title: 'Reclaim Docker Disk Space',
    description: 'Remove unused containers, images and volumes',
    contentType: 'text',
    content: 'docker system prune -a --volumes',
    fileUrl: null,
    fileName: null,
    fileSize: null,
    url: null,
    language: 'bash',
    isFavorite: false,
    isPinned: false,
    typeId: 'type_command',
    collectionId: null,
    tags: ['docker', 'cleanup'],
    createdAt: '2024-01-03T08:30:00.000Z',
    updatedAt: '2024-01-03T08:30:00.000Z',
  },
];
