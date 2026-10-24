import type { TextFile } from './store.ts';

/** An in-memory file: `text` is what's on "disk", `writes` counts saves. */
export function memoryFile(
  initial?: string,
): TextFile & { text: string | undefined; writes: number } {
  const file = {
    path: '/project/file',
    text: initial,
    writes: 0,
    async read() {
      return file.text;
    },
    async write(next: string) {
      file.text = next;
      file.writes++;
    },
  };
  return file;
}
