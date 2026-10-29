import { join, resolve, sep } from 'node:path';

/**
 * Where the built canvas is, given the directory of the server's code: a `canvas` folder beside it in
 * the npm package, where the bundled server and the canvas build ship together, else the canvas app's
 * build output in a checkout.
 */
export function canvasDirFor(codeDir: string, isDir: (path: string) => boolean): string {
  const packaged = join(codeDir, 'canvas');
  return isDir(packaged) ? packaged : join(codeDir, '..', '..', 'canvas', 'build');
}

/**
 * Maps a request path to a file under `root`, or null when the path escapes it. Paths without a file
 * extension are app routes and get the SPA's index.html.
 */
export function resolveStatic(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const base = resolve(root);
  const target = resolve(base, `.${decoded}`);
  if (target !== base && !target.startsWith(base + sep)) return null;
  const last = decoded.split('/').at(-1) ?? '';
  return last.includes('.') ? target : resolve(base, 'index.html');
}
