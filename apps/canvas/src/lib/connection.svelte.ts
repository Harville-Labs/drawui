import {
  type CanvasOp,
  decode,
  type FromCanvas,
  type ProjectConfig,
  type ProjectPatch,
  toCanvas,
  WS_PATH,
} from '@drawui/core';

export type Status = 'connecting' | 'open' | 'closed';

export type SceneData = { elements: readonly unknown[]; files: Record<string, unknown> };

export type Handlers = {
  /** The whole saved drawing, sent when a tab connects or reconnects. */
  load(scene: SceneData): void;
  /** Another tab changed the drawing. */
  scene(scene: SceneData): void;
  /** An agent asked for work only the canvas can do. Resolve with the reply data, or throw. */
  request(op: CanvasOp): Promise<unknown>;
};

const MIN_RETRY_MS = 250;
const MAX_RETRY_MS = 5000;
// How long an agent's activity message stays in the top bar.
const ACTIVITY_MS = 4000;

/** The canvas tab's link to the drawui server. Reconnects on its own, with backoff. */
export class Connection {
  status = $state<Status>('connecting');
  project = $state<ProjectConfig>({});
  activity = $state('');

  private socket: WebSocket | undefined;
  private retryMs = MIN_RETRY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private activityTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;

  constructor(private readonly handlers: Handlers) {}

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.activityTimer);
    this.socket?.close();
  }

  sendScene(scene: SceneData): void {
    this.send({ type: 'scene', elements: [...scene.elements], files: scene.files });
  }

  sendSelection(ids: string[]): void {
    this.send({ type: 'selection', ids });
  }

  setProject(patch: ProjectPatch): void {
    this.send({ type: 'project', patch });
  }

  private send(message: FromCanvas): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private connect(): void {
    const url = new URL(WS_PATH, location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    this.socket = socket;
    this.status = 'connecting';
    socket.onopen = () => {
      this.status = 'open';
      this.retryMs = MIN_RETRY_MS;
    };
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') void this.receive(event.data);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.status = 'closed';
      if (this.stopped) return;
      this.retryTimer = setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
    };
  }

  private async receive(raw: string): Promise<void> {
    const message = decode(toCanvas, raw);
    // The server and canvas ship together, so a message that doesn't parse is a bug; dropping it
    // keeps the drawing usable.
    if (!message) return;
    switch (message.type) {
      case 'load':
        this.project = message.project;
        this.handlers.load(message);
        break;
      case 'scene':
        this.handlers.scene(message);
        break;
      case 'project':
        this.project = message.project;
        break;
      case 'activity':
        this.activity = message.text;
        clearTimeout(this.activityTimer);
        this.activityTimer = setTimeout(() => {
          this.activity = '';
        }, ACTIVITY_MS);
        break;
      case 'request':
        try {
          const data = await this.handlers.request(message.op);
          this.send({ type: 'reply', requestId: message.requestId, result: { ok: true, data } });
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          this.send({
            type: 'reply',
            requestId: message.requestId,
            result: { ok: false, error: text.slice(0, 2000) },
          });
        }
        break;
    }
  }
}
