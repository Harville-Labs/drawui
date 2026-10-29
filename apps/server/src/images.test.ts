import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetPath, imageOf, saveImage } from './images.ts';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const elements = [
  { id: 'logo', type: 'image', fileId: 'f1' },
  { id: 'box', type: 'rectangle' },
  { id: 'pending', type: 'image', fileId: 'missing' },
];
const files = {
  f1: {
    id: 'f1',
    mimeType: 'image/png',
    dataURL: `data:image/png;base64,${png.toString('base64')}`,
  },
};

describe('imageOf', () => {
  test('decodes the file behind an image element', () => {
    expect(imageOf(elements, files, 'logo')).toEqual({ mimeType: 'image/png', bytes: png });
  });

  test('says what is wrong for a missing id, a shape, and a file not yet synced', () => {
    expect(() => imageOf(elements, files, 'nope')).toThrow('No element "nope"');
    expect(() => imageOf(elements, files, 'box')).toThrow('"box" is not an image');
    expect(() => imageOf(elements, files, 'pending')).toThrow("hasn't reached the server");
  });
});

describe('assetPath', () => {
  test('resolves a path inside the project', () => {
    expect(assetPath('/p', 'static/logo.png', 'image/png')).toBe('/p/static/logo.png');
  });

  test('refuses paths that leave the project', () => {
    expect(() => assetPath('/p', '../logo.png', 'image/png')).toThrow('outside the project');
    expect(() => assetPath('/p', '/etc/logo.png', 'image/png')).toThrow('outside the project');
  });

  test('refuses an extension that does not match the image type', () => {
    expect(() => assetPath('/p', 'logo.svg', 'image/png')).toThrow('save it with .png');
  });
});

describe('saveImage', () => {
  const dirs: string[] = [];
  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true });
  });

  test('writes the image, creating folders, and never overwrites', async () => {
    const root = await mkdtemp(join(tmpdir(), 'drawui-images-'));
    dirs.push(root);
    const image = { mimeType: 'image/png', bytes: png };
    expect(await saveImage(root, 'src/assets/logo.png', image)).toBe('src/assets/logo.png');
    expect(await readFile(join(root, 'src/assets/logo.png'))).toEqual(png);
    await expect(saveImage(root, 'src/assets/logo.png', image)).rejects.toThrow('already exists');
  });
});
