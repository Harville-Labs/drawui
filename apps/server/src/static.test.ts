import { describe, expect, test } from 'bun:test';
import { isLocalHost, isLocalOrigin } from './http.ts';
import { resolveStatic } from './static.ts';

describe('resolveStatic', () => {
  test('files resolve under the root', () => {
    expect(resolveStatic('/app', '/_app/x.js')).toBe('/app/_app/x.js');
  });

  test('routes without an extension get index.html', () => {
    expect(resolveStatic('/app', '/')).toBe('/app/index.html');
    expect(resolveStatic('/app', '/some/route')).toBe('/app/index.html');
  });

  test('paths that escape the root are refused, encoded or not', () => {
    expect(resolveStatic('/app', '/../etc/passwd')).toBeNull();
    expect(resolveStatic('/app', '/%2e%2e/etc/passwd')).toBeNull();
    expect(resolveStatic('/app', '/..%2fsecret.txt')).toBeNull();
    expect(resolveStatic('/app', '/a%00.js')).toBeNull();
    expect(resolveStatic('/app', '/%E0%A4%A')).toBeNull();
  });

  test('a sibling directory with the same prefix is outside the root', () => {
    expect(resolveStatic('/app', '/../app-secrets/key.pem')).toBeNull();
  });
});

describe('host checks', () => {
  test('only loopback names on our port pass', () => {
    expect(isLocalHost('localhost:4747', 4747)).toBe(true);
    expect(isLocalHost('127.0.0.1:4747', 4747)).toBe(true);
    expect(isLocalHost('[::1]:4747', 4747)).toBe(true);
    expect(isLocalHost('evil.example:4747', 4747)).toBe(false);
    expect(isLocalHost('localhost:80', 4747)).toBe(false);
    expect(isLocalHost(null, 4747)).toBe(false);
  });

  test('requests without an Origin, or from the canvas, pass', () => {
    expect(isLocalOrigin(null, 4747)).toBe(true);
    expect(isLocalOrigin('http://localhost:4747', 4747)).toBe(true);
    expect(isLocalOrigin('https://evil.example', 4747)).toBe(false);
    expect(isLocalOrigin('http://localhost:3000', 4747)).toBe(false);
  });
});
