// Builds the npm package in dist/drawui: the server bundled into one Bun script, with
// @drawui/core, zod, and the MCP SDK inlined, beside the static canvas build. The package has no
// dependencies, so `bunx drawui` starts without installing anything else.
//
// Run `bun run build` first, then `bun scripts/package.ts`. Publish with `npm publish dist/drawui`.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import server from '../apps/server/package.json';

const root = join(import.meta.dir, '..');
const out = join(root, 'dist', 'drawui');
const canvas = join(root, 'apps', 'canvas', 'build');

if (!(await stat(join(canvas, 'index.html')).catch(() => undefined))) {
  console.error("package: the canvas isn't built. Run `bun run build` first.");
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const built = await Bun.build({
  entrypoints: [join(root, 'apps', 'server', 'src', 'main.ts')],
  outdir: out,
  naming: 'drawui.js',
  target: 'bun',
  minify: { syntax: true, whitespace: true },
});
if (!built.success) {
  for (const log of built.logs) console.error(log);
  process.exit(1);
}

await cp(canvas, join(out, 'canvas'), { recursive: true });
for (const file of ['README.md', 'LICENSE', 'NOTICE', 'CHANGELOG.md']) {
  await cp(join(root, file), join(out, file));
}

const manifest = {
  name: server.name,
  version: server.version,
  description:
    'A local Excalidraw canvas for sketching UI, with an MCP server that lets a coding agent build it.',
  license: server.license,
  type: 'module',
  bin: { drawui: 'drawui.js' },
  files: ['drawui.js', 'canvas', 'README.md', 'LICENSE', 'NOTICE', 'CHANGELOG.md'],
  engines: { bun: '>=1.4.0' },
  repository: { type: 'git', url: 'git+https://github.com/Harville-Labs/drawui.git' },
  homepage: 'https://github.com/Harville-Labs/drawui#readme',
  bugs: 'https://github.com/Harville-Labs/drawui/issues',
  keywords: ['excalidraw', 'mcp', 'ui', 'sketch', 'agent'],
};
await Bun.write(join(out, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${out}`);
