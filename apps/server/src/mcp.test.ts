import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { decode, type ToCanvas, toCanvas } from '@drawui/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Server } from 'bun';
import { serve } from './http.ts';
import { Hub } from './hub.ts';
import { ProjectStore } from './project.ts';
import { SceneStore } from './store.ts';
import { memoryFile } from './test-support.ts';

let server: Server<undefined>;
let base: string;
let scene: SceneStore;
let client: Client;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  scene = await SceneStore.open(memoryFile());
  const project = await ProjectStore.open(memoryFile('{"library": "Sivir UI"}'));
  // Port 0 picks a free port; the canvas URL only shows up in error text.
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
  client = new Client({ name: 'test', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://${base}/mcp`)));
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.close();
  await client.close();
  server.stop(true);
});

/** A canvas tab that answers draw requests with a scene holding one rectangle per shape. */
async function fakeCanvas(): Promise<ToCanvas[]> {
  const received: ToCanvas[] = [];
  const ws = new WebSocket(`ws://${base}/ws`);
  sockets.push(ws);
  ws.onmessage = (event) => {
    const message = decode(toCanvas, String(event.data));
    if (!message) return;
    received.push(message);
    if (message.type !== 'request' || message.op.kind !== 'draw') return;
    const elements = message.op.shapes.map((shape, i) => ({
      id: shape.id ?? `s${i}`,
      type: 'rectangle',
      x: 0,
      y: i * 50,
      width: 100,
      height: 40,
    }));
    ws.send(JSON.stringify({ type: 'scene', elements, files: {} }));
    ws.send(
      JSON.stringify({
        type: 'reply',
        requestId: message.requestId,
        result: { ok: true, data: { ids: elements.map((el) => el.id) } },
      }),
    );
  };
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  while (!received.some((m) => m.type === 'load')) await Bun.sleep(5);
  return received;
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [first] = result.content as { type: string; text?: string }[];
  return first?.text ?? '';
}

describe('MCP over HTTP', () => {
  test('lists the drawing tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'annotate',
        'delete',
        'draw',
        'get_canvas',
        'get_canvas_image',
        'get_image',
        'get_project',
        'get_selection',
        'set_project',
        'update',
        'wait_for_change',
      ].sort(),
    );
  });

  test('get_canvas on a blank drawing', async () => {
    expect(textOf(await client.callTool({ name: 'get_canvas', arguments: {} }))).toBe(
      'version 0\n(empty canvas)',
    );
  });

  test('drawing with no canvas open is an error that says where to open it', async () => {
    const result = await client.callTool({
      name: 'draw',
      arguments: { shapes: [{ type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }] },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Open http://localhost:4747');
  });

  test('draw goes through the canvas and shows up in get_canvas', async () => {
    const received = await fakeCanvas();
    const result = await client.callTool({
      name: 'draw',
      arguments: {
        shapes: [{ type: 'rectangle', id: 'btn', x: 0, y: 0, width: 100, height: 40, label: 'Go' }],
      },
    });
    expect(textOf(result)).toBe('Drew btn.');
    expect(received.some((m) => m.type === 'activity')).toBe(true);
    expect(textOf(await client.callTool({ name: 'get_canvas', arguments: {} }))).toContain('[btn]');
  });

  test('wait_for_change returns the new outline after the canvas edits', async () => {
    await fakeCanvas();
    const waiting = client.callTool({
      name: 'wait_for_change',
      arguments: { since: 0, timeoutSeconds: 5 },
    });
    await Bun.sleep(50);
    scene.mergeScene([{ id: 'new', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }], {});
    expect(textOf(await waiting)).toStartWith('version 1');
  });

  test('get_image returns a dropped image as image content', async () => {
    const data = Buffer.from('fake png').toString('base64');
    scene.mergeScene(
      [{ id: 'shot', type: 'image', fileId: 'f', x: 0, y: 0, width: 9, height: 9 }],
      {
        f: { id: 'f', mimeType: 'image/png', dataURL: `data:image/png;base64,${data}` },
      },
    );
    const result = await client.callTool({ name: 'get_image', arguments: { id: 'shot' } });
    expect(result.content).toEqual([
      { type: 'text', text: 'image/png, 8 bytes.' },
      { type: 'image', data, mimeType: 'image/png' },
    ]);
  });

  test('get_project reports the library and its docs', async () => {
    const text = textOf(await client.callTool({ name: 'get_project', arguments: {} }));
    expect(JSON.parse(text)).toMatchObject({
      library: 'Sivir UI',
      libraryDocs: 'https://www.sivir.dev',
      canvasOpen: false,
    });
  });

  test('a custom library reports the docs link the user gave', async () => {
    await client.callTool({
      name: 'set_project',
      arguments: { library: 'Acme UI', docs: 'https://ui.acme.dev/docs' },
    });
    const text = textOf(await client.callTool({ name: 'get_project', arguments: {} }));
    expect(JSON.parse(text)).toMatchObject({
      library: 'Acme UI',
      libraryDocs: 'https://ui.acme.dev/docs',
    });
    await client.callTool({ name: 'set_project', arguments: { library: 'Sivir UI', docs: '' } });
  });

  test('set_project rejects a non-http preview', async () => {
    const result = await client.callTool({
      name: 'set_project',
      arguments: { preview: 'file:///etc/passwd' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('HTTP guards', () => {
  test('a foreign Host header is refused', async () => {
    const res = await fetch(`http://${base}/healthz`, { headers: { host: 'evil.example' } });
    expect(res.status).toBe(403);
  });

  test('a cross-site Origin is refused', async () => {
    const res = await fetch(`http://${base}/mcp`, {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });

  test('an unbuilt canvas says how to build it', async () => {
    const res = await fetch(`http://${base}/`);
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('bun run build');
  });
});
