import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';

/** The image types Excalidraw accepts, and the file extensions each may be saved with. */
const EXTENSIONS: Record<string, readonly string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
};

const imageElement = z.looseObject({
  id: z.string(),
  type: z.literal('image'),
  fileId: z.string(),
  isDeleted: z.boolean().optional(),
});
const binaryFile = z.looseObject({ mimeType: z.string(), dataURL: z.string() });

export type DrawnImage = { mimeType: string; bytes: Uint8Array };

/** The file behind an image element the user dropped on the canvas, decoded from its data URL. */
export function imageOf(
  elements: readonly unknown[],
  files: Readonly<Record<string, unknown>>,
  id: string,
): DrawnImage {
  const raw = elements.find((el) => (el as { id?: unknown })?.id === id);
  if (!raw) throw new Error(`No element "${id}" on the canvas. get_canvas lists the ids.`);
  const el = imageElement.safeParse(raw);
  if (!el.success || el.data.isDeleted) {
    throw new Error(`"${id}" is not an image. get_canvas shows images as lines starting "image".`);
  }
  const file = binaryFile.safeParse(files[el.data.fileId]);
  const match = file.success ? file.data.dataURL.match(/^data:([^;,]+);base64,(.*)$/s) : null;
  if (!file.success || !match?.[2]) {
    throw new Error(
      `The file for image "${id}" hasn't reached the server yet. Ask the user to keep the canvas open a moment and try again.`,
    );
  }
  return { mimeType: file.data.mimeType, bytes: Buffer.from(match[2], 'base64') };
}

/**
 * Checks where the agent wants to save an image: inside the project, with an extension that matches
 * the image's type. Returns the absolute path.
 */
export function assetPath(root: string, path: string, mimeType: string): string {
  const absolute = resolve(root, path);
  const inside = relative(root, absolute);
  if (!inside || inside.startsWith('..') || isAbsolute(inside)) {
    throw new Error(`"${path}" is outside the project. Give a path relative to ${root}.`);
  }
  const allowed = EXTENSIONS[mimeType];
  if (!allowed) throw new Error(`Images of type ${mimeType} can't be saved.`);
  if (!allowed.includes(extname(absolute).toLowerCase())) {
    throw new Error(`This image is ${mimeType}; save it with ${allowed.join(' or ')}.`);
  }
  return absolute;
}

/** Writes the image into the project. Never overwrites, since the file may be the user's. */
export async function saveImage(root: string, path: string, image: DrawnImage): Promise<string> {
  const absolute = assetPath(root, path, image.mimeType);
  if (existsSync(absolute)) {
    throw new Error(`${path} already exists. Pick another path, or delete it first if it's stale.`);
  }
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, image.bytes, { flag: 'wx' });
  return relative(root, absolute);
}
