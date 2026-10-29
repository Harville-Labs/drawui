import { describe, expect, test } from 'bun:test';
import { type Element, parseElements } from './elements.ts';
import { findNode, interpret, selectedSubtrees } from './interpret.ts';

let next = 0;
function el(fields: Partial<Element> & { type: string }): Element {
  next += 1;
  const [parsed] = parseElements([
    { id: `e${next}`, x: 0, y: 0, width: 10, height: 10, ...fields },
  ]);
  if (!parsed) throw new Error('fixture element failed to parse');
  return parsed;
}
const rect = (id: string, x: number, y: number, width: number, height: number, extra = {}) =>
  el({ id, type: 'rectangle', x, y, width, height, ...extra });
const text = (id: string, x: number, y: number, body: string, extra = {}) =>
  el({ id, type: 'text', x, y, width: body.length * 8, height: 20, text: body, ...extra });
const arrow = (id: string, from: [number, number], to: [number, number], extra = {}) =>
  el({
    id,
    type: 'arrow',
    x: from[0],
    y: from[1],
    width: to[0] - from[0],
    height: to[1] - from[1],
    points: [
      [0, 0],
      [to[0] - from[0], to[1] - from[1]],
    ],
    ...extra,
  });

describe('containment', () => {
  test('a shape inside a rectangle becomes its child', () => {
    const tree = interpret([rect('outer', 0, 0, 200, 200), rect('inner', 20, 20, 50, 30)]);
    expect(tree.roots.map((n) => n.id)).toEqual(['outer']);
    expect(tree.roots[0]?.children.map((n) => n.id)).toEqual(['inner']);
  });

  test('the smallest containing rectangle is the parent', () => {
    const tree = interpret([
      rect('page', 0, 0, 500, 500),
      rect('card', 10, 10, 200, 200),
      rect('button', 20, 20, 50, 20),
    ]);
    expect(findNode(tree.roots, 'card')?.children.map((n) => n.id)).toEqual(['button']);
    expect(findNode(tree.roots, 'page')?.children.map((n) => n.id)).toEqual(['card']);
  });

  test('hand-drawn edges a few pixels over still count as inside', () => {
    const tree = interpret([rect('outer', 0, 0, 100, 100), rect('inner', -3, 10, 50, 30)]);
    expect(tree.roots[0]?.children.map((n) => n.id)).toEqual(['inner']);
  });

  test('a partly overlapping shape is not a child', () => {
    const tree = interpret([rect('a', 0, 0, 100, 100), rect('b', 80, 80, 100, 100)]);
    expect(tree.roots.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('frames are screens and hold elements tagged with their frameId even when they overflow', () => {
    const tree = interpret([
      el({ id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 300, name: 'Login' }),
      rect('wide', 250, 20, 200, 40, { frameId: 'f' }),
    ]);
    expect(tree.roots[0]).toMatchObject({ kind: 'screen', label: 'Login' });
    expect(tree.roots[0]?.children.map((n) => n.id)).toEqual(['wide']);
  });

  test('deleted elements are ignored', () => {
    const tree = interpret([rect('gone', 0, 0, 10, 10, { isDeleted: true })]);
    expect(tree.roots).toEqual([]);
  });
});

describe('labels and text', () => {
  test('text bound to a shape becomes its label, not a node', () => {
    const tree = interpret([
      rect('btn', 0, 0, 100, 40, { boundElements: [{ id: 't', type: 'text' }] }),
      text('t', 10, 10, 'Sign up', { containerId: 'btn' }),
    ]);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0]).toMatchObject({ id: 'btn', label: 'Sign up', children: [] });
  });

  test('loose text next to other children is a text child', () => {
    const tree = interpret([
      rect('card', 0, 0, 200, 100),
      text('t', 10, 10, 'Email'),
      rect('field', 10, 40, 150, 30),
    ]);
    expect(tree.roots[0]?.children[0]).toMatchObject({ kind: 'text', label: 'Email' });
    expect(tree.roots[0]?.label).toBeUndefined();
  });

  test('free text alone inside an unlabeled shape is its label', () => {
    const tree = interpret([rect('btn', 0, 0, 120, 50), text('t', 30, 15, 'Save')]);
    expect(tree.roots[0]).toMatchObject({ id: 'btn', label: 'Save', children: [] });
    expect(selectedSubtrees(tree, ['t'], []).map((n) => n.id)).toEqual(['btn']);
  });

  test('free text alone inside a frame stays a child, since the frame name is its label', () => {
    const tree = interpret([
      el({ id: 'f', type: 'frame', x: 0, y: 0, width: 300, height: 300, name: 'Home' }),
      text('t', 10, 10, 'Welcome'),
    ]);
    expect(tree.roots[0]).toMatchObject({ label: 'Home' });
    expect(tree.roots[0]?.children[0]).toMatchObject({ kind: 'text', label: 'Welcome' });
  });

  test('label and text colors are text colors, not strokes', () => {
    const tree = interpret([
      rect('btn', 0, 0, 120, 50, { strokeColor: '#e03131' }),
      text('t', 10, 10, 'Delete', { containerId: 'btn', strokeColor: '#ffffff' }),
      rect('card', 200, 0, 300, 100),
      text('warn', 210, 10, 'Careful', { strokeColor: '#f08c00' }),
      rect('field', 210, 40, 150, 30),
      rect('hollow', 600, 0, 120, 50),
      text('free', 630, 15, 'Go', { strokeColor: '#2f9e44' }),
    ]);
    expect(findNode(tree.roots, 'btn')).toMatchObject({ stroke: '#e03131', textColor: '#ffffff' });
    const warn = findNode(tree.roots, 'warn');
    expect(warn).toMatchObject({ textColor: '#f08c00' });
    expect(warn?.stroke).toBeUndefined();
    expect(findNode(tree.roots, 'hollow')).toMatchObject({ label: 'Go', textColor: '#2f9e44' });
  });

  test("a frame's default stroke is not reported, a recolored one is", () => {
    const frame = (id: string, x: number, strokeColor: string) =>
      el({ id, type: 'frame', x, y: 0, width: 100, height: 100, strokeColor });
    const tree = interpret([frame('plain', 0, '#bbb'), frame('red', 200, '#e03131')]);
    expect(tree.roots[0]?.stroke).toBeUndefined();
    expect(tree.roots[1]?.stroke).toBe('#e03131');
  });

  test('a // note inside a container attaches to it', () => {
    const tree = interpret([
      rect('card', 0, 0, 300, 100),
      text('n', 10, 10, '// make this sticky'),
    ]);
    expect(tree.roots[0]?.notes).toEqual(['make this sticky']);
    expect(tree.roots[0]?.children).toEqual([]);
  });

  test('text marked as a note in customData is a note without the prefix', () => {
    const tree = interpret([
      rect('card', 0, 0, 300, 100),
      text('n', 10, 10, 'primary', { customData: { drawui: { kind: 'note' } } }),
    ]);
    expect(tree.roots[0]?.notes).toEqual(['primary']);
  });

  test('a note pointed at an element attaches to that element', () => {
    const tree = interpret([
      rect('btn', 0, 0, 100, 40),
      text('n', 300, 0, '// disabled until valid'),
      arrow('a', [300, 10], [50, 20], {
        startBinding: { elementId: 'n' },
        endBinding: { elementId: 'btn' },
      }),
    ]);
    expect(tree.roots.map((n) => n.id)).toEqual(['btn']);
    expect(tree.roots[0]?.notes).toEqual(['disabled until valid']);
    expect(tree.arrows).toEqual([]);
  });

  test('a free-standing note stays a root note', () => {
    const tree = interpret([text('n', 0, 0, '// dark theme everywhere')]);
    expect(tree.roots[0]).toMatchObject({ kind: 'note', label: 'dark theme everywhere' });
  });

  test('a malformed drawui block is ignored instead of dropping the element', () => {
    const tree = interpret([
      rect('r', 0, 0, 10, 10, { customData: { drawui: { kind: 'bogus' } } }),
    ]);
    expect(tree.roots.map((n) => n.id)).toEqual(['r']);
  });
});

describe('arrows', () => {
  test('bindings name the ends, and bound text is the label', () => {
    const tree = interpret([
      rect('login', 0, 0, 100, 100),
      rect('home', 300, 0, 100, 100),
      arrow('a', [100, 50], [300, 50], {
        startBinding: { elementId: 'login' },
        endBinding: { elementId: 'home' },
      }),
      text('l', 180, 40, 'on success', { containerId: 'a' }),
    ]);
    expect(tree.arrows).toEqual([{ id: 'a', from: 'login', to: 'home', label: 'on success' }]);
  });

  test('unbound ends resolve to the smallest element under the point', () => {
    const tree = interpret([
      rect('page', 0, 0, 500, 500),
      rect('btn', 10, 10, 50, 20),
      rect('other', 300, 300, 50, 50),
      arrow('a', [20, 20], [320, 320]),
    ]);
    expect(tree.arrows[0]).toMatchObject({ from: 'btn', to: 'other' });
  });

  test('an end over empty canvas is null', () => {
    const tree = interpret([rect('btn', 0, 0, 50, 20), arrow('a', [10, 10], [900, 900])]);
    expect(tree.arrows[0]).toMatchObject({ from: 'btn', to: null });
  });

  test('an arrow bound to a label resolves to the label container', () => {
    const tree = interpret([
      rect('btn', 0, 0, 100, 40),
      text('t', 10, 10, 'Go', { containerId: 'btn' }),
      rect('dest', 300, 0, 100, 40),
      arrow('a', [50, 20], [350, 20], {
        startBinding: { elementId: 't' },
        endBinding: { elementId: 'dest' },
      }),
    ]);
    expect(tree.arrows[0]).toMatchObject({ from: 'btn', to: 'dest' });
  });
});

describe('layout', () => {
  test('children side by side are a row, in left-to-right order', () => {
    const tree = interpret([
      rect('nav', 0, 0, 400, 50),
      rect('c', 300, 10, 50, 30),
      rect('a', 10, 10, 50, 30),
      rect('b', 150, 12, 50, 30),
    ]);
    expect(tree.roots[0]?.layout).toBe('row');
    expect(tree.roots[0]?.children.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  test('stacked children are a column, top to bottom', () => {
    const tree = interpret([
      rect('form', 0, 0, 200, 300),
      rect('b', 10, 100, 100, 30),
      rect('a', 10, 10, 100, 30),
    ]);
    expect(tree.roots[0]?.layout).toBe('column');
    expect(tree.roots[0]?.children.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('equal rows of several are a grid', () => {
    const tree = interpret([
      rect('g', 0, 0, 300, 300),
      rect('a', 10, 10, 50, 50),
      rect('b', 100, 10, 50, 50),
      rect('c', 10, 100, 50, 50),
      rect('d', 100, 100, 50, 50),
    ]);
    expect(tree.roots[0]?.layout).toBe('grid');
  });

  test('uneven rows are rows', () => {
    const tree = interpret([
      rect('g', 0, 0, 300, 300),
      rect('a', 10, 10, 50, 50),
      rect('b', 100, 10, 50, 50),
      rect('c', 10, 100, 50, 50),
    ]);
    expect(tree.roots[0]?.layout).toBe('rows');
  });

  test('a single child has no layout hint', () => {
    const tree = interpret([rect('g', 0, 0, 300, 300), rect('a', 10, 10, 50, 50)]);
    expect(tree.roots[0]?.layout).toBeUndefined();
  });
});

describe('attributes', () => {
  test('non-default colors, dashes, links, sources, and agent authorship are reported', () => {
    const tree = interpret([
      rect('r', 0, 0, 10, 10, {
        backgroundColor: '#a5d8ff',
        strokeColor: '#e03131',
        strokeStyle: 'dashed',
        link: '/settings',
        customData: { drawui: { author: 'agent', source: { file: 'src/App.svelte', line: 3 } } },
      }),
    ]);
    expect(tree.roots[0]).toMatchObject({
      fill: '#a5d8ff',
      stroke: '#e03131',
      dashed: true,
      link: '/settings',
      byAgent: true,
      source: { file: 'src/App.svelte', line: 3 },
    });
  });

  test('default colors are left out', () => {
    const node = interpret([rect('r', 0, 0, 10, 10)]).roots[0];
    expect(node?.fill).toBeUndefined();
    expect(node?.stroke).toBeUndefined();
  });

  test('boxes of linear sketches measure their points', () => {
    const tree = interpret([
      el({
        id: 'l',
        type: 'line',
        x: 100,
        y: 100,
        width: 50,
        height: 0,
        points: [
          [0, 0],
          [-50, 20],
        ],
      }),
    ]);
    expect(tree.roots[0]).toMatchObject({
      kind: 'sketch',
      box: { x: 50, y: 100, width: 50, height: 20 },
    });
  });
});

describe('selection', () => {
  test('a selected label selects its container, and nested picks collapse into the ancestor', () => {
    const elements = [
      rect('card', 0, 0, 300, 300),
      rect('btn', 10, 10, 100, 40),
      text('t', 20, 20, 'Go', { containerId: 'btn' }),
      rect('other', 400, 0, 50, 50),
    ];
    const tree = interpret(elements);
    expect(selectedSubtrees(tree, ['t'], elements).map((n) => n.id)).toEqual(['btn']);
    expect(selectedSubtrees(tree, ['card', 'btn'], elements).map((n) => n.id)).toEqual(['card']);
  });

  test('a selected note selects the element it annotates', () => {
    const elements = [
      rect('card', 0, 0, 300, 300),
      text('n', 20, 20, '// rounded corners'),
      rect('other', 400, 0, 50, 50),
    ];
    const tree = interpret(elements);
    expect(selectedSubtrees(tree, ['n'], elements).map((n) => n.id)).toEqual(['card']);
  });
});
