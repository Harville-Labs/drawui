import { expect, test } from 'bun:test';
import { packageRoot, renderNotices } from './licenses.ts';

test('packageRoot finds the package a bundled file belongs to', () => {
  expect(packageRoot('/r/node_modules/zod/v4/index.js')).toBe('/r/node_modules/zod');
  expect(packageRoot('/r/node_modules/@scope/pkg/dist/a.js')).toBe('/r/node_modules/@scope/pkg');
});

test('packageRoot takes the innermost package in nested node_modules', () => {
  expect(packageRoot('/r/node_modules/.bun/a@1/node_modules/a/index.js')).toBe(
    '/r/node_modules/.bun/a@1/node_modules/a',
  );
});

test('packageRoot reads through the marker rollup puts on CommonJS wrappers', () => {
  expect(packageRoot('\0/r/node_modules/react/index.js?commonjs-module')).toBe(
    '/r/node_modules/react',
  );
});

test("packageRoot skips the project's own files", () => {
  expect(packageRoot('/r/apps/server/src/main.ts')).toBeUndefined();
  expect(packageRoot('/r/node_modules/@scope')).toBeUndefined();
});

test('renderNotices lists packages by name, then fonts, each with its license text', () => {
  const notice = (name: string, version = '1.0.0') => ({
    name,
    version,
    license: 'MIT',
    text: `${name} text\n`,
  });
  const out = renderNotices([notice('zod'), notice('ajv')], [notice('Virgil', '')]);
  expect(out.indexOf('## ajv 1.0.0')).toBeLessThan(out.indexOf('## zod 1.0.0'));
  expect(out.indexOf('## zod')).toBeLessThan(out.indexOf('# Fonts'));
  expect(out).toContain('## Virgil\n');
  expect(out).toContain('```\najv text\n```');
});
