// A whole agent session, scripted: the real server, the MCP client an agent uses, and a headless
// canvas tab that runs the canvas's own ops. Only Excalidraw's rendering is missing (happy-dom has
// no canvas), so this checks what the agent reads and draws, not how the drawing looks.
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { decode, type ToCanvas, toCanvas } from '@drawui/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Server } from 'bun';
import { serve } from './http.ts';
import { Hub } from './hub.ts';
import { ProjectStore } from './project.ts';
import { SceneStore } from './store.ts';
import { memoryFile } from './test-support.ts';

// The canvas ops load Excalidraw, which needs a DOM; test-dom keeps Bun's networking globals.
await import('../../canvas/src/lib/test-dom.ts');
const { applyOp } = await import('../../canvas/src/lib/ops.ts');

type Elements = Parameters<typeof applyOp>[0];

let server: Server<undefined>;
let base: string;
let client: Client;
let tab: WebSocket;
let elements: Elements = [];

beforeAll(async () => {
  const scene = await SceneStore.open(memoryFile());
  const project = await ProjectStore.open(memoryFile('{"library": "Sivir UI"}'));
  const ctx = {
    root: '/nonexistent-drawui-project',
    scenePath: '/x/drawui.excalidraw',
    canvasUrl: 'http://localhost:4747',
    scene,
    project,
    hub: new Hub('http://localhost:4747'),
  };
  server = serve(ctx, { port: 0, canvasDir: '/nonexistent-drawui-canvas' });
  base = `127.0.0.1:${server.port}`;
  await openTab();
  client = new Client({ name: 'session-test', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://${base}/mcp`)));
});

afterAll(async () => {
  tab.close();
  await client.close();
  server.stop(true);
});

/** A canvas tab without Excalidraw's UI: it keeps the elements and runs requests as the Bridge does. */
async function openTab(): Promise<void> {
  tab = new WebSocket(`ws://${base}/ws`);
  let loaded = false;
  tab.onmessage = async (event) => {
    const message = decode(toCanvas, String(event.data)) as ToCanvas | null;
    if (!message) return;
    if (message.type === 'load' || message.type === 'scene') {
      elements = message.elements as Elements;
      loaded = true;
    }
    if (message.type !== 'request') return;
    try {
      const outcome = await applyOp(elements, {}, message.op);
      if ('elements' in outcome) {
        elements = outcome.elements;
        send({ type: 'scene', elements, files: {} });
      }
      reply(message.requestId, { ok: true, data: outcome.data });
    } catch (error) {
      reply(message.requestId, { ok: false, error: (error as Error).message });
    }
  };
  await new Promise((resolve) => {
    tab.onopen = resolve;
  });
  while (!loaded) await Bun.sleep(5);
}

function send(message: unknown) {
  tab.send(JSON.stringify(message));
}

function reply(requestId: string, result: unknown) {
  send({ type: 'reply', requestId, result });
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const [first] = result.content as { type: string; text?: string }[];
  if (result.isError) throw new Error(first?.text);
  return first?.text ?? '';
}

test('an agent draws a screen, reads it back, edits it, and sees the user answer', async () => {
  expect(await call('get_project')).toContain('Sivir UI');

  const drawn = await call('draw', {
    shapes: [
      { type: 'frame', id: 'login', x: 0, y: 0, width: 390, height: 844, name: 'Login (mobile)' },
      { type: 'rectangle', id: 'email', x: 24, y: 120, width: 342, height: 48, label: 'Email' },
      { type: 'rectangle', id: 'submit', x: 24, y: 200, width: 342, height: 48, label: 'Sign in' },
      { type: 'rectangle', id: 'home', x: 600, y: 0, width: 390, height: 300, label: 'Home' },
      { type: 'arrow', id: 'go', from: 'submit', to: 'home', label: 'on success' },
    ],
  });
  expect(drawn).toContain('login');

  const outline = await call('get_canvas');
  expect(outline).toContain('screen "Login (mobile)" [login]');
  expect(outline).toContain('device=phone');
  expect(outline).toMatch(/"Email" \[email\][\s\S]*"Sign in" \[submit\]/);
  expect(outline).toContain('on success');

  await call('update', { patches: [{ id: 'submit', label: 'Log in', fill: '#1971c2' }] });
  await call('annotate', { id: 'submit', text: 'Disabled until the email is valid' });
  const edited = await call('get_canvas');
  expect(edited).toContain('"Log in" [submit]');
  expect(edited).toContain('// Disabled until the email is valid');

  // The user draws a second size of the screen while the agent waits.
  const version = Number(/^version (\d+)/.exec(edited)?.[1]);
  const waiting = call('wait_for_change', { since: version, timeoutSeconds: 10 });
  await Bun.sleep(50);
  elements = [
    ...elements,
    {
      ...(elements.find((el) => el.id === 'login') as Elements[number]),
      id: 'login-desktop',
      name: 'Login (desktop)',
      x: 1200,
      width: 1440,
      height: 900,
      version: 1,
      versionNonce: 1,
    } as Elements[number],
  ];
  send({ type: 'scene', elements, files: {} });
  const answer = await waiting;
  expect(answer).toContain('screens drawn for several devices:');
  expect(answer).toContain('"Login": phone [login], desktop [login-desktop]');
});
