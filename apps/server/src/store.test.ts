import { describe, expect, test } from 'bun:test';
import { SceneStore } from './store.ts';
import { memoryFile } from './test-support.ts';

const rect = { id: 'a', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 };

describe('SceneStore', () => {
  test('a missing file opens as a blank drawing at version 0', async () => {
    const store = await SceneStore.open(memoryFile());
    expect(store.snapshot).toEqual({ elements: [], files: {}, selection: [], version: 0 });
  });

  test('opens an existing Excalidraw file', async () => {
    const file = memoryFile(JSON.stringify({ type: 'excalidraw', elements: [rect], files: {} }));
    expect((await SceneStore.open(file)).snapshot.elements).toEqual([rect]);
  });

  test('rejects a file that is not an Excalidraw scene, naming the file', async () => {
    await expect(SceneStore.open(memoryFile('{"hello": 1}'))).rejects.toThrow(
      '/project/file is not an Excalidraw scene',
    );
    await expect(SceneStore.open(memoryFile('nope'))).rejects.toThrow('is not valid JSON');
  });

  test('a change bumps the version and is saved in Excalidraw format', async () => {
    const file = memoryFile();
    const store = await SceneStore.open(file);
    expect(store.setScene([rect], {})).toBe(true);
    await store.flush();
    expect(store.snapshot.version).toBe(1);
    expect(JSON.parse(file.text ?? '')).toMatchObject({
      type: 'excalidraw',
      source: 'drawui',
      elements: [rect],
    });
  });

  test('an identical scene is not a change', async () => {
    const file = memoryFile();
    const store = await SceneStore.open(file);
    store.setScene([rect], {});
    await store.flush();
    expect(store.setScene([{ ...rect }], {})).toBe(false);
    await store.flush();
    expect(store.snapshot.version).toBe(1);
    expect(file.writes).toBe(1);
  });

  test('changes made during a save are written after it', async () => {
    const file = memoryFile();
    const store = await SceneStore.open(file);
    store.setScene([rect], {});
    store.setScene([{ ...rect, x: 5 }], {});
    await store.flush();
    expect(JSON.parse(file.text ?? '').elements[0].x).toBe(5);
  });

  test('waitForChange resolves at once when the version is already past', async () => {
    const store = await SceneStore.open(memoryFile());
    store.setScene([rect], {});
    expect(await store.waitForChange(0, 1000)).toBe(true);
  });

  test('waitForChange wakes on the next change', async () => {
    const store = await SceneStore.open(memoryFile());
    const waiting = store.waitForChange(0, 5000);
    store.setScene([rect], {});
    expect(await waiting).toBe(true);
  });

  test('waitForChange gives up after the timeout or on abort', async () => {
    const store = await SceneStore.open(memoryFile());
    expect(await store.waitForChange(0, 10)).toBe(false);
    const abort = new AbortController();
    const waiting = store.waitForChange(0, 5000, abort.signal);
    abort.abort();
    expect(await waiting).toBe(false);
  });

  test('selection changes do not bump the version', async () => {
    const store = await SceneStore.open(memoryFile());
    store.setSelection(['a']);
    expect(store.snapshot).toMatchObject({ selection: ['a'], version: 0 });
  });
});
