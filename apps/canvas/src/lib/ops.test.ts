import { describe, expect, test } from 'bun:test';
import { type CanvasOp, FRAME_STROKE, gapBetween, interpret } from '@drawui/core';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import './test-dom.ts';

// Excalidraw needs the DOM when it loads, so ops load after test-dom has registered one.
const { applyOp, newScreen } = await import('./ops.ts');

type Elements = ExcalidrawElement[];

async function run(
  elements: Elements,
  op: CanvasOp,
): Promise<{ elements: Elements; data: unknown }> {
  const outcome = await applyOp(elements, {}, op);
  if (!('elements' in outcome)) throw new Error(`${op.kind} changed nothing`);
  return outcome as { elements: Elements; data: unknown };
}

const live = (elements: Elements) => elements.filter((el) => !el.isDeleted);
const byId = (elements: Elements, id: string) => elements.find((el) => el.id === id);
const box = (el: ExcalidrawElement) => ({ x: el.x, y: el.y, width: el.width, height: el.height });

describe('newScreen', () => {
  test('names the frame for its device and sizes it like one', () => {
    const frame = newScreen([], 'Login', 'phone');
    expect(frame).toMatchObject({ type: 'frame', name: 'Login (mobile)', width: 390, height: 844 });
    expect(frame.strokeColor).toBe(FRAME_STROKE);
  });

  test('goes right of what is drawn, so sizes of one screen sit side by side', async () => {
    const { elements } = await run([], {
      kind: 'draw',
      shapes: [{ type: 'rectangle', id: 'card', x: 100, y: 50, width: 200, height: 100 }],
    });
    const frame = newScreen(elements, 'Login', 'desktop');
    expect(frame).toMatchObject({ name: 'Login (desktop)', y: 50 });
    expect(frame.x).toBeGreaterThan(300);
  });
});

describe('draw', () => {
  test('a frame at the origin stays there and draws in the frame stroke', async () => {
    const { elements } = await run([], {
      kind: 'draw',
      shapes: [{ type: 'frame', id: 'f', x: 0, y: 0, width: 390, height: 844, name: 'Home' }],
    });
    const frame = byId(elements, 'f');
    expect(frame && box(frame)).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    expect(frame?.strokeColor).toBe(FRAME_STROKE);
  });

  test('a shape drawn inside a frame belongs to it', async () => {
    const { elements } = await run([], {
      kind: 'draw',
      shapes: [
        { type: 'frame', id: 'f', x: 0, y: 0, width: 390, height: 844 },
        { type: 'rectangle', id: 'r', x: 20, y: 20, width: 100, height: 40 },
      ],
    });
    expect(byId(elements, 'r')?.frameId).toBe('f');
  });

  test('an arrow joins the shapes it names, and get_canvas reads it that way', async () => {
    const { elements, data } = await run([], {
      kind: 'draw',
      shapes: [
        { type: 'rectangle', id: 'a', x: 0, y: 0, width: 100, height: 50 },
        { type: 'rectangle', id: 'b', x: 300, y: 0, width: 100, height: 50 },
        { type: 'arrow', id: 'go', from: 'a', to: 'b', label: 'next' },
      ],
    });
    expect(data).toEqual({ ids: ['a', 'b', 'go'] });
    expect(interpret(elements as never).arrows).toEqual([
      expect.objectContaining({ id: 'go', from: 'a', to: 'b', label: 'next' }),
    ]);
  });

  test('refuses an id that is already drawn', async () => {
    const first = await run([], {
      kind: 'draw',
      shapes: [{ type: 'rectangle', id: 'r', x: 0, y: 0, width: 100, height: 40 }],
    });
    expect(
      run(first.elements, {
        kind: 'draw',
        shapes: [{ type: 'ellipse', id: 'r', x: 0, y: 0, width: 80, height: 80 }],
      }),
    ).rejects.toThrow('already exists');
  });

  test('a deleted id can be drawn again, one version up so it wins across tabs', async () => {
    const first = await run([], {
      kind: 'draw',
      shapes: [{ type: 'rectangle', id: 'r', x: 0, y: 0, width: 100, height: 40 }],
    });
    const deleted = await run(first.elements, { kind: 'delete', ids: ['r'] });
    const before = byId(deleted.elements, 'r')?.version ?? 0;
    const { elements } = await run(deleted.elements, {
      kind: 'draw',
      shapes: [{ type: 'ellipse', id: 'r', x: 0, y: 0, width: 80, height: 80 }],
    });
    const shapes = elements.filter((el) => el.id === 'r');
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.type).toBe('ellipse');
    expect(shapes[0]?.version).toBeGreaterThan(before);
  });
});

describe('update', () => {
  test('adds a label to a shape that has none', async () => {
    const drawn = await run([], {
      kind: 'draw',
      shapes: [{ type: 'rectangle', id: 'r', x: 0, y: 0, width: 160, height: 40 }],
    });
    const { elements } = await run(drawn.elements, {
      kind: 'update',
      patches: [{ id: 'r', label: 'Save' }],
    });
    expect(interpret(elements as never).roots[0]?.label).toBe('Save');
  });

  test('names a missing element with a hint to find the right id', async () => {
    expect(run([], { kind: 'update', patches: [{ id: 'nope', x: 1 }] })).rejects.toThrow(
      'get_canvas lists the ids',
    );
  });
});

describe('delete', () => {
  test('keeps a tombstone so other tabs see the delete', async () => {
    const drawn = await run([], {
      kind: 'draw',
      shapes: [{ type: 'rectangle', id: 'r', x: 0, y: 0, width: 100, height: 40, label: 'Go' }],
    });
    const { elements } = await run(drawn.elements, { kind: 'delete', ids: ['r'] });
    expect(byId(elements, 'r')?.isDeleted).toBe(true);
    expect(live(elements)).toHaveLength(0);
  });
});

describe('annotate', () => {
  test('puts the note beside its target without covering other shapes', async () => {
    const drawn = await run([], {
      kind: 'draw',
      shapes: [
        { type: 'rectangle', id: 'target', x: 0, y: 0, width: 100, height: 40 },
        { type: 'rectangle', id: 'right', x: 140, y: -20, width: 200, height: 200 },
      ],
    });
    const { elements } = await run(drawn.elements, {
      kind: 'annotate',
      id: 'target',
      text: 'Make this the primary button',
    });
    const note = live(elements).find((el) => el.type === 'text' && !el.containerId);
    if (!note) throw new Error('no note drawn');
    const right = byId(elements, 'right') as ExcalidrawElement;
    expect(gapBetween(box(note), box(right))).toBeGreaterThan(0);
    // The note reads as being about the target.
    expect(interpret(elements as never).roots.find((n) => n.id === 'target')?.notes).toEqual([
      'Make this the primary button',
    ]);
  });
});
