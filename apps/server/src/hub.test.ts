import { describe, expect, test } from 'bun:test';
import type { ToCanvas } from '@drawui/core';
import { CanvasError, Hub, NoCanvasError } from './hub.ts';

function socket() {
  const sent: ToCanvas[] = [];
  return { sent, send: (data: string) => sent.push(JSON.parse(data)) };
}

const exportOp = { kind: 'export' } as const;

function requestId(s: ReturnType<typeof socket>): string {
  const last = s.sent.at(-1);
  if (last?.type !== 'request') throw new Error('expected a request');
  return last.requestId;
}

describe('Hub', () => {
  test('a request with no canvas open says how to open one', async () => {
    await expect(new Hub('http://localhost:4747').request(exportOp, 100)).rejects.toThrow(
      NoCanvasError,
    );
    await expect(new Hub('http://localhost:4747').request(exportOp, 100)).rejects.toThrow(
      'Open http://localhost:4747',
    );
  });

  test('a request goes to the most recently touched canvas and resolves with its reply', async () => {
    const hub = new Hub('');
    const a = socket();
    const b = socket();
    hub.add(a);
    hub.add(b);
    hub.touch(a);
    const pending = hub.request(exportOp, 1000);
    expect(b.sent).toEqual([]);
    hub.reply(a, {
      type: 'reply',
      requestId: requestId(a),
      result: { ok: true, data: { png: 'x' } },
    });
    expect(await pending).toEqual({ png: 'x' });
  });

  test('an error reply rejects with the canvas message', async () => {
    const hub = new Hub('');
    const a = socket();
    hub.add(a);
    const pending = hub.request(exportOp, 1000);
    hub.reply(a, {
      type: 'reply',
      requestId: requestId(a),
      result: { ok: false, error: 'No element "x".' },
    });
    await expect(pending).rejects.toThrow(new CanvasError('No element "x".'));
  });

  test('a reply from another tab is ignored', async () => {
    const hub = new Hub('');
    const a = socket();
    const b = socket();
    hub.add(b);
    hub.add(a);
    const pending = hub.request(exportOp, 50);
    hub.reply(b, { type: 'reply', requestId: requestId(a), result: { ok: true, data: 1 } });
    await expect(pending).rejects.toThrow("didn't answer");
  });

  test('closing a canvas fails its pending requests', async () => {
    const hub = new Hub('');
    const a = socket();
    hub.add(a);
    const pending = hub.request(exportOp, 1000);
    hub.remove(a);
    await expect(pending).rejects.toThrow('closed');
    expect(hub.connected).toBe(0);
  });

  test('broadcast skips the sender', () => {
    const hub = new Hub('');
    const a = socket();
    const b = socket();
    hub.add(a);
    hub.add(b);
    hub.broadcast({ type: 'activity', text: 'hi' }, a);
    expect(a.sent).toEqual([]);
    expect(b.sent).toEqual([{ type: 'activity', text: 'hi' }]);
  });
});
