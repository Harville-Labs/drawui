// Copies Excalidraw's fonts into static/ so the canvas never fetches them from a CDN.
import { cp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const pkg = dirname(Bun.resolveSync('@excalidraw/excalidraw/package.json', import.meta.dir));
const target = join(import.meta.dir, '..', 'static', 'fonts');
await rm(target, { recursive: true, force: true });
await cp(join(pkg, 'dist', 'prod', 'fonts'), target, { recursive: true });
