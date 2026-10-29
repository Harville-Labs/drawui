import { describe, expect, test } from 'bun:test';
import { mergeScenes } from './merge.ts';

const el = (id: string, version: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  version,
  versionNonce: 1,
  ...extra,
});
const scene = (...elements: unknown[]) => ({ elements, files: {} });

describe('mergeScenes', () => {
  test('a tab that has not seen another tab’s edit does not overwrite it', () => {
    const held = scene(el('a', 3, { x: 50 }), el('b', 1));
    const stale = scene(el('a', 2, { x: 0 }), el('b', 2, { x: 9 }));
    const merged = mergeScenes(held, stale);
    expect(merged.elements).toEqual([el('a', 3, { x: 50 }), el('b', 2, { x: 9 })]);
    expect(merged.senderBehind).toBe(true);
  });

  test('a newer copy from the sender replaces the held one and needs nothing back', () => {
    const merged = mergeScenes(scene(el('a', 1)), scene(el('a', 2, { x: 5 })));
    expect(merged).toEqual({ elements: [el('a', 2, { x: 5 })], files: {}, senderBehind: false });
  });

  test('an element only the server holds is kept, and the sender is told', () => {
    const merged = mergeScenes(scene(el('a', 1), el('other-tab', 1)), scene(el('a', 1)));
    expect(merged.elements).toEqual([el('a', 1), el('other-tab', 1)]);
    expect(merged.senderBehind).toBe(true);
  });

  test('equal versions are settled by the lower nonce, the way Excalidraw does', () => {
    const held = scene(el('a', 2, { versionNonce: 5, x: 1 }));
    const low = scene(el('a', 2, { versionNonce: 3, x: 2 }));
    const high = scene(el('a', 2, { versionNonce: 9, x: 3 }));
    expect(mergeScenes(held, low).elements).toEqual(low.elements);
    expect(mergeScenes(held, high).elements).toEqual(held.elements);
  });

  test('elements are ordered by fractional index', () => {
    const merged = mergeScenes(
      scene(el('top', 1, { index: 'a2' })),
      scene(el('bottom', 1, { index: 'a0' }), el('mid', 1, { index: 'a1' })),
    );
    expect(merged.elements.map((e) => (e as { id: string }).id)).toEqual(['bottom', 'mid', 'top']);
  });

  test('files from both are kept', () => {
    const merged = mergeScenes(
      { elements: [], files: { f1: { id: 'f1' } } },
      { elements: [], files: { f2: { id: 'f2' } } },
    );
    expect(Object.keys(merged.files)).toEqual(['f1', 'f2']);
    expect(merged.senderBehind).toBe(true);
  });
});
