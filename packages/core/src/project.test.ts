import { describe, expect, test } from 'bun:test';
import { canvasOp } from './ops.ts';
import { applyProjectPatch, detectStack, docsFor, projectConfig } from './project.ts';
import { decode, fromCanvas } from './protocol.ts';

describe('detectStack', () => {
  test('SvelteKit with Sivir and Tailwind', () => {
    const pkg = {
      devDependencies: {
        '@sveltejs/kit': '2',
        svelte: '5',
        '@sivir-ui/svelte': '0.4',
        tailwindcss: '4',
      },
    };
    expect(detectStack(pkg, false)).toEqual({
      framework: 'sveltekit',
      tailwind: true,
      libraries: ['Sivir UI'],
    });
  });

  test('Next wins over React, and components.json means shadcn/ui', () => {
    const pkg = { dependencies: { next: '15', react: '19' } };
    expect(detectStack(pkg, true)).toEqual({
      framework: 'next',
      tailwind: false,
      libraries: ['shadcn/ui'],
    });
  });

  test('components.json in a Svelte project means shadcn-svelte', () => {
    expect(detectStack({ dependencies: { svelte: '5' } }, true).libraries).toEqual([
      'shadcn-svelte',
    ]);
  });

  test('no package.json is a blank project', () => {
    expect(detectStack(undefined, false)).toEqual({
      framework: 'none',
      tailwind: false,
      libraries: [],
    });
  });
});

describe('project config', () => {
  test('an empty string in a patch clears the field', () => {
    expect(
      applyProjectPatch({ library: 'Sivir UI', preview: 'http://localhost:5173' }, { preview: '' }),
    ).toEqual({
      library: 'Sivir UI',
    });
  });

  test("a custom docs link wins over the suggested library's docs", () => {
    expect(docsFor({ library: 'Sivir UI' })).toBe('https://www.sivir.dev');
    expect(docsFor({ library: 'Acme UI', docs: 'https://ui.acme.dev/docs' })).toBe(
      'https://ui.acme.dev/docs',
    );
    expect(docsFor({ library: 'Acme UI' })).toBeUndefined();
  });

  test('the docs link must be http or https', () => {
    expect(projectConfig.safeParse({ docs: 'file:///etc/passwd' }).success).toBe(false);
    expect(applyProjectPatch({ library: 'Acme', docs: 'https://acme.dev' }, { docs: '' })).toEqual({
      library: 'Acme',
    });
  });

  test('the preview must be http or https', () => {
    expect(projectConfig.safeParse({ preview: 'javascript:alert(1)' }).success).toBe(false);
    expect(projectConfig.safeParse({ preview: 'http://localhost:5173/' }).success).toBe(true);
  });
});

describe('protocol and ops', () => {
  test('decode rejects invalid JSON and unknown message types', () => {
    expect(decode(fromCanvas, 'not json')).toBeUndefined();
    expect(decode(fromCanvas, '{"type":"nope"}')).toBeUndefined();
    expect(decode(fromCanvas, '{"type":"selection","ids":["a"]}')).toEqual({
      type: 'selection',
      ids: ['a'],
    });
  });

  test('draw ops reject bad colors and arrows without both ends', () => {
    const shape = { type: 'rectangle', x: 0, y: 0, width: 10, height: 10 };
    expect(canvasOp.safeParse({ kind: 'draw', shapes: [{ ...shape, fill: 'red' }] }).success).toBe(
      false,
    );
    expect(
      canvasOp.safeParse({ kind: 'draw', shapes: [{ type: 'arrow', from: 'a' }] }).success,
    ).toBe(false);
    expect(
      canvasOp.safeParse({ kind: 'draw', shapes: [{ ...shape, fill: '#a5d8ff' }] }).success,
    ).toBe(true);
  });
});
