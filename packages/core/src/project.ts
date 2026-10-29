import { z } from 'zod';

/** Libraries the canvas suggests. The agent reads each library's docs and types itself; this only names them. */
export const SUGGESTED_LIBRARIES = [
  {
    name: 'Sivir UI',
    framework: 'svelte',
    docs: 'https://www.sivir.dev',
    package: '@sivir-ui/svelte',
  },
  { name: 'shadcn/ui', framework: 'react', docs: 'https://ui.shadcn.com', package: 'shadcn' },
  {
    name: 'shadcn-svelte',
    framework: 'svelte',
    docs: 'https://www.shadcn-svelte.com',
    package: 'shadcn-svelte',
  },
] as const;

const httpUrl = (what: string) =>
  z
    .url({ protocol: /^https?$/, error: `The ${what} must be an http:// or https:// URL.` })
    .max(2000);
const previewUrl = httpUrl('preview');
const docsUrl = httpUrl('docs link');

/** `drawui.json` in the project root. Every field is optional; a blank project starts with `{}`. */
export const projectConfig = z.object({
  library: z.string().trim().min(1).max(100).optional(),
  /** Where the agent reads the library's docs, for a library drawui doesn't suggest. */
  docs: docsUrl.optional(),
  preview: previewUrl.optional(),
});
export type ProjectConfig = z.infer<typeof projectConfig>;

export const projectPatch = z.object({
  library: z.string().trim().max(100).optional(),
  docs: z.union([docsUrl, z.literal('')]).optional(),
  preview: z.union([previewUrl, z.literal('')]).optional(),
});
export type ProjectPatch = z.infer<typeof projectPatch>;

/** Applies a patch; an empty string clears that field. */
export function applyProjectPatch(config: ProjectConfig, patch: ProjectPatch): ProjectConfig {
  const next: ProjectConfig = { ...config };
  for (const key of ['library', 'docs', 'preview'] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value === '') delete next[key];
    else next[key] = value;
  }
  return next;
}

/** The docs the agent should read: the project's own link, else the suggested library's. */
export function docsFor(config: ProjectConfig): string | undefined {
  if (config.docs) return config.docs;
  return SUGGESTED_LIBRARIES.find((lib) => lib.name === config.library)?.docs;
}

const packageJson = z.looseObject({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

export type Stack = {
  framework: 'sveltekit' | 'svelte' | 'next' | 'react' | 'vue' | 'nuxt' | 'astro' | 'none';
  tailwind: boolean;
  /** Component libraries already installed. */
  libraries: string[];
};

/**
 * Works out the project's stack from its package.json (raw JSON or undefined when there's none) and
 * whether a shadcn `components.json` exists.
 */
export function detectStack(rawPackageJson: unknown, hasComponentsJson: boolean): Stack {
  const parsed = packageJson.safeParse(rawPackageJson);
  const deps = parsed.success
    ? { ...parsed.data.dependencies, ...parsed.data.devDependencies }
    : {};
  const has = (name: string) => name in deps;
  const framework: Stack['framework'] = has('@sveltejs/kit')
    ? 'sveltekit'
    : has('svelte')
      ? 'svelte'
      : has('next')
        ? 'next'
        : has('nuxt')
          ? 'nuxt'
          : has('astro')
            ? 'astro'
            : has('react')
              ? 'react'
              : has('vue')
                ? 'vue'
                : 'none';
  const libraries: string[] = [];
  if (has('@sivir-ui/svelte')) libraries.push('Sivir UI');
  const svelte = framework === 'svelte' || framework === 'sveltekit';
  if (hasComponentsJson) libraries.push(svelte ? 'shadcn-svelte' : 'shadcn/ui');
  return { framework, tailwind: has('tailwindcss'), libraries };
}
