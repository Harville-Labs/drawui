// Builds the npm package in dist/drawui: the server bundled into one Bun script, with
// @drawui/core, zod, and the MCP SDK inlined, beside the static canvas build. The package has no
// dependencies, so `bunx drawui` starts without installing anything else.
//
// Run `bun run build` first, then `bun scripts/package.ts`. Publish with `npm publish dist/drawui`.
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SHIPPED_MODULES } from '../apps/canvas/scripts/shipped-modules.ts';
import server from '../apps/server/package.json';
import { type Notice, packageRoot, readNotice, renderNotices } from './licenses.ts';

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
  metafile: true,
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

// Packages that ship without a license file; the texts in licenses/ come from their repositories.
const licenses = join(root, 'licenses');
const fallbackFiles: Record<string, string> = {
  '@excalidraw/excalidraw': 'excalidraw.LICENSE',
  '@radix-ui': 'radix-ui.LICENSE',
  '@scritto/core': 'scritto.LICENSE',
  fastdom: 'fastdom.LICENSE',
  'react-remove-scroll-bar': 'react-remove-scroll-bar.LICENSE',
};
const fallbacks: Record<string, string> = {};
for (const [name, file] of Object.entries(fallbackFiles)) {
  fallbacks[name] = await Bun.file(join(licenses, file)).text();
}
const bundled = [
  ...Object.keys(built.metafile?.inputs ?? {}).map((input) => join(root, input)),
  ...((await Bun.file(SHIPPED_MODULES).json()) as string[]),
];
const dirs = new Set(bundled.map(packageRoot).filter((dir) => dir !== undefined));
const notices = new Map<string, Notice>();
for (const dir of dirs) {
  const notice = await readNotice(dir, fallbacks);
  notices.set(`${notice.name}@${notice.version}`, notice);
}
const fontDir = join(licenses, 'fonts');
const fonts = await Promise.all(
  (await readdir(fontDir))
    .filter((name) => name.endsWith('.txt'))
    .map(async (name) => ({
      name: name.replace(/\.txt$/, ''),
      version: '',
      license: 'see text',
      text: await Bun.file(join(fontDir, name)).text(),
    })),
);
await Bun.write(join(out, 'THIRD_PARTY_LICENSES.md'), renderNotices([...notices.values()], fonts));

const manifest = {
  name: server.name,
  version: server.version,
  description:
    'A local Excalidraw canvas for sketching UI, with an MCP server that lets a coding agent build it.',
  license: server.license,
  type: 'module',
  bin: { drawui: 'drawui.js' },
  files: [
    'drawui.js',
    'canvas',
    'README.md',
    'LICENSE',
    'NOTICE',
    'THIRD_PARTY_LICENSES.md',
    'CHANGELOG.md',
  ],
  engines: { bun: '>=1.4.0' },
  repository: { type: 'git', url: 'git+https://github.com/Harville-Labs/drawui.git' },
  homepage: 'https://github.com/Harville-Labs/drawui#readme',
  bugs: 'https://github.com/Harville-Labs/drawui/issues',
  keywords: ['excalidraw', 'mcp', 'ui', 'sketch', 'agent'],
};
await Bun.write(join(out, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${out}`);
