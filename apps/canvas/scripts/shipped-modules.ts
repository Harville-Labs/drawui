// Records which node_modules files end up in the browser bundle, so scripts/package.ts can list
// their licenses. Only the client build ships; the server-side build SvelteKit runs for prerendering
// doesn't.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

export const SHIPPED_MODULES = join(
  import.meta.dirname,
  '..',
  '.svelte-kit',
  'shipped-modules.json',
);

export function shippedModules(): Plugin {
  return {
    name: 'drawui:shipped-modules',
    apply: 'build',
    async generateBundle(_options, bundle) {
      if (this.environment.name !== 'client') return;
      // Fonts and images that CSS pulls in are assets, not modules, and their names are relative.
      const assets = Object.values(bundle).flatMap((output) =>
        output.type === 'asset' ? output.originalFileNames.map((name) => resolve(name)) : [],
      );
      const ids = [...new Set([...this.getModuleIds(), ...assets])]
        .filter((id) => id.includes('/node_modules/'))
        .sort();
      await mkdir(dirname(SHIPPED_MODULES), { recursive: true });
      await writeFile(SHIPPED_MODULES, `${JSON.stringify(ids, null, 2)}\n`);
    },
  };
}
