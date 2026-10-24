import { join } from 'node:path';
import { decode, fromCanvas, WS_PATH } from '@drawui/core';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Server, ServerWebSocket } from 'bun';
import { type Context, createMcpServer } from './mcp.ts';
import { resolveStatic } from './static.ts';

// Drawings carry pasted images as data URLs, so a scene message can be large.
const MAX_MESSAGE_BYTES = 64 * 1024 * 1024;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * True when a Host header names this server on a loopback name. Checked on every request so a web
 * page can't reach the server through DNS rebinding.
 */
export function isLocalHost(host: string | null, port: number): boolean {
  return host !== null && LOCAL_HOSTS.some((name) => host === `${name}:${port}`);
}

/** True when a request has no Origin (a non-browser client) or comes from the canvas itself. */
export function isLocalOrigin(origin: string | null, port: number): boolean {
  if (origin === null) return true;
  return LOCAL_HOSTS.some((name) => origin === `http://${name}:${port}`);
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function plain(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS },
  });
}

async function handleMcp(ctx: Context, req: Request): Promise<Response> {
  // Stateless: a fresh server and transport per request, all sharing the same scene and hub.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer(ctx);
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}

async function handleStatic(canvasDir: string, pathname: string): Promise<Response> {
  const path = resolveStatic(canvasDir, pathname);
  if (path === null) return plain(400, 'Bad path.');
  const file = Bun.file(path);
  if (!(await file.exists())) {
    if (pathname === '/' || !pathname.includes('.')) {
      return plain(
        503,
        'The canvas is not built. Run `bun run build` in the drawui repository, then reload.',
      );
    }
    return plain(404, 'Not found.');
  }
  const headers: Record<string, string> = { ...SECURITY_HEADERS };
  // SvelteKit content-hashes everything under _app/immutable.
  if (pathname.startsWith('/_app/immutable/'))
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  return new Response(file, { headers });
}

export type ServeOptions = { port: number; canvasDir: string };

/** Starts the server: the canvas app, its WebSocket, and the MCP endpoint, on loopback only. */
export function serve(ctx: Context, { port, canvasDir }: ServeOptions): Server<undefined> {
  const { scene, project, hub } = ctx;

  const server: Server<undefined> = Bun.serve({
    hostname: '127.0.0.1',
    port,
    async fetch(req, srv) {
      if (!isLocalHost(req.headers.get('host'), srv.port ?? port)) {
        return plain(403, 'drawui only answers requests addressed to localhost.');
      }
      if (!isLocalOrigin(req.headers.get('origin'), srv.port ?? port)) {
        return plain(403, 'drawui only answers requests from its own canvas.');
      }
      const { pathname } = new URL(req.url);
      if (pathname === '/healthz') return plain(200, 'ok');
      if (pathname === '/mcp') {
        // wait_for_change holds the request open for minutes.
        srv.timeout(req, 0);
        return handleMcp(ctx, req);
      }
      if (pathname === WS_PATH) {
        return srv.upgrade(req) ? undefined : plain(400, 'Expected a WebSocket upgrade.');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return plain(405, 'Method not allowed.');
      return handleStatic(canvasDir, pathname);
    },
    websocket: {
      maxPayloadLength: MAX_MESSAGE_BYTES,
      open(ws) {
        hub.add(ws);
        const { elements, files } = scene.snapshot;
        hub.send(ws, {
          type: 'load',
          elements: [...elements],
          files: { ...files },
          project: project.current,
        });
      },
      async message(ws: ServerWebSocket<undefined>, raw) {
        const message = decode(fromCanvas, typeof raw === 'string' ? raw : raw.toString());
        // A malformed message is a canvas bug, not something to act on; ignore it rather than drop the tab.
        if (!message) return;
        switch (message.type) {
          case 'scene':
            hub.touch(ws);
            if (scene.setScene(message.elements, message.files)) {
              hub.broadcast(
                { type: 'scene', elements: message.elements, files: message.files },
                ws,
              );
            }
            break;
          case 'selection':
            hub.touch(ws);
            scene.setSelection(message.ids);
            break;
          case 'project':
            hub.broadcast({ type: 'project', project: await project.update(message.patch) });
            break;
          case 'reply':
            hub.reply(ws, message);
            break;
        }
      },
      close(ws) {
        hub.remove(ws);
      },
    },
  });
  return server;
}

/** Where the built canvas lives relative to this file. */
export const DEFAULT_CANVAS_DIR = join(import.meta.dir, '..', '..', 'canvas', 'build');
