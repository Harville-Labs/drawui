import type { CanvasOp, FromCanvas, ToCanvas } from '@drawui/core';

/** The part of a WebSocket the hub needs. */
export interface CanvasSocket {
  send(data: string): void;
}

export class NoCanvasError extends Error {
  constructor(url: string) {
    super(
      `No canvas is open. Open ${url} in a browser: drawing needs the canvas to lay out elements.`,
    );
    this.name = 'NoCanvasError';
  }
}

export class CanvasError extends Error {
  override name = 'CanvasError';
}

type Pending = {
  socket: CanvasSocket;
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Tracks open canvas tabs and runs agent requests on the one the user touched last. */
export class Hub {
  #sockets: CanvasSocket[] = [];
  #pending = new Map<string, Pending>();

  constructor(private readonly canvasUrl: string) {}

  get connected(): number {
    return this.#sockets.length;
  }

  add(socket: CanvasSocket): void {
    this.#sockets.push(socket);
  }

  remove(socket: CanvasSocket): void {
    this.#sockets = this.#sockets.filter((s) => s !== socket);
    for (const [id, pending] of this.#pending) {
      if (pending.socket !== socket) continue;
      this.#settle(id)?.reject(
        new CanvasError('The canvas closed before it finished the request.'),
      );
    }
  }

  /** Marks a tab as the one the user is working in. */
  touch(socket: CanvasSocket): void {
    if (!this.#sockets.includes(socket)) return;
    this.#sockets = [...this.#sockets.filter((s) => s !== socket), socket];
  }

  send(socket: CanvasSocket, message: ToCanvas): void {
    socket.send(JSON.stringify(message));
  }

  broadcast(message: ToCanvas, except?: CanvasSocket): void {
    const data = JSON.stringify(message);
    for (const socket of this.#sockets) if (socket !== except) socket.send(data);
  }

  request(op: CanvasOp, timeoutMs: number): Promise<unknown> {
    const socket = this.#sockets.at(-1);
    if (!socket) return Promise.reject(new NoCanvasError(this.canvasUrl));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#settle(requestId)?.reject(
          new CanvasError(`The canvas didn't answer within ${Math.round(timeoutMs / 1000)}s.`),
        );
      }, timeoutMs);
      this.#pending.set(requestId, { socket, resolve, reject, timer });
      this.send(socket, { type: 'request', requestId, op });
    });
  }

  /** Delivers a canvas reply to the request waiting on it. Replies from another tab are ignored. */
  reply(socket: CanvasSocket, message: Extract<FromCanvas, { type: 'reply' }>): void {
    if (this.#pending.get(message.requestId)?.socket !== socket) return;
    const pending = this.#settle(message.requestId);
    if (!pending) return;
    if (message.result.ok) pending.resolve(message.result.data);
    else pending.reject(new CanvasError(message.result.error));
  }

  #settle(id: string): Pending | undefined {
    const pending = this.#pending.get(id);
    if (!pending) return undefined;
    clearTimeout(pending.timer);
    this.#pending.delete(id);
    return pending;
  }
}
