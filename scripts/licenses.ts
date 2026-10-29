// Builds THIRD_PARTY_LICENSES.md for the npm package: every package bundled into the server or the
// canvas, with its license text, then the fonts the canvas serves.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export type Notice = { name: string; version: string; license: string; text: string };

/** The package directory a bundled file belongs to, or undefined for the project's own files. */
export function packageRoot(id: string): string | undefined {
  // Rollup marks the modules its plugins make up, such as CommonJS wrappers, with a leading \0.
  const path = id.replace(/^\0/, '');
  const marker = '/node_modules/';
  const at = path.lastIndexOf(marker);
  if (at < 0) return undefined;
  const rest = path.slice(at + marker.length).split('/');
  const depth = rest[0]?.startsWith('@') ? 2 : 1;
  if (rest.length <= depth) return undefined;
  return path.slice(0, at + marker.length) + rest.slice(0, depth).join('/');
}

export function renderNotices(packages: Notice[], fonts: Notice[]): string {
  const section = (notice: Notice) =>
    `## ${`${notice.name} ${notice.version}`.trim()}\n\nLicense: ${notice.license}\n\n\`\`\`\n${notice.text.trim()}\n\`\`\`\n`;
  const byName = (a: Notice, b: Notice) => a.name.localeCompare(b.name);
  return [
    '# Third-party licenses\n',
    'drawui bundles the packages and fonts below. Each keeps its own license.\n',
    ...[...packages].sort(byName).map(section),
    '# Fonts\n',
    'The canvas serves these fonts, copied from @excalidraw/excalidraw.\n',
    ...[...fonts].sort(byName).map(section),
  ].join('\n');
}

const LICENSE_FILE = /^(licen[cs]e|copying)([.-][\w.-]+)?$/i;

/**
 * Reads a package's name, version, license, and license text. `fallbacks` holds texts for packages
 * that ship none, by package name or by scope, like `@radix-ui`.
 */
export async function readNotice(dir: string, fallbacks: Record<string, string>): Promise<Notice> {
  const pkg = await Bun.file(join(dir, 'package.json')).json();
  const file = (await readdir(dir)).find((name) => LICENSE_FILE.test(name));
  const text = file
    ? await Bun.file(join(dir, file)).text()
    : (fallbacks[pkg.name] ?? fallbacks[pkg.name.split('/')[0]]);
  if (!text) {
    throw new Error(
      `${pkg.name} ships no license file. Add its license text to licenses/ and to the fallbacks in scripts/package.ts.`,
    );
  }
  return { name: pkg.name, version: pkg.version, license: String(pkg.license ?? 'see text'), text };
}
