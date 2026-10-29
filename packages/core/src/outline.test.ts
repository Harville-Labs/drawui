import { expect, test } from 'bun:test';
import { parseElements } from './elements.ts';
import { interpret } from './interpret.ts';
import { outline } from './outline.ts';

test('an empty canvas says so', () => {
  expect(outline(interpret([]))).toBe('(empty canvas)');
});

test('the outline nests children, shows notes, marks selection, and lists arrows by label', () => {
  const elements = parseElements([
    {
      id: 'f',
      type: 'frame',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      name: 'Login',
      strokeColor: '#bbb',
    },
    {
      id: 'btn',
      type: 'rectangle',
      x: 20,
      y: 200,
      width: 100,
      height: 40,
      backgroundColor: '#a5d8ff',
    },
    {
      id: 't',
      type: 'text',
      x: 30,
      y: 210,
      width: 50,
      height: 20,
      text: 'Sign in',
      containerId: 'btn',
    },
    { id: 'n', type: 'text', x: 20, y: 20, width: 200, height: 20, text: '// center this form' },
    { id: 'home', type: 'rectangle', x: 600, y: 0, width: 100, height: 100 },
    {
      id: 'a',
      type: 'arrow',
      x: 120,
      y: 220,
      width: 480,
      height: -170,
      points: [
        [0, 0],
        [480, -170],
      ],
      startBinding: { elementId: 'btn' },
      endBinding: { elementId: 'home' },
    },
  ]);
  expect(outline(interpret(elements), new Set(['btn']))).toBe(
    [
      'screen "Login" [f] 0,0 400x300',
      '  // center this form',
      '  * rectangle "Sign in" [btn] 20,200 100x40 fill=#a5d8ff',
      'rectangle [home] 600,0 100x100',
      '',
      'arrows:',
      '  [a] "Sign in" -> [home]',
    ].join('\n'),
  );
});

test('sources and agent authorship appear on the line', () => {
  const elements = parseElements([
    {
      id: 'r',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      customData: {
        drawui: { author: 'agent', source: { file: 'src/Nav.svelte', line: 4, component: 'Nav' } },
      },
    },
  ]);
  expect(outline(interpret(elements))).toBe(
    'rectangle [r] 0,0 10x10 source=src/Nav.svelte:4 (Nav) by-agent',
  );
});
