// Excalidraw reads `window` and `document` when it loads, so op tests run in happy-dom. Import this
// before anything that imports Excalidraw, and unregister after, so other test files keep Bun's own
// fetch and WebSocket.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost:4747/' });

// happy-dom has no canvas. Excalidraw only probes the 2D context on load and measures text with it,
// so a context that measures every character as 8px wide is enough for ops that don't render.
const context = new Proxy(
  {
    filter: 'none',
    font: '',
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
    }),
  },
  { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
);
HTMLCanvasElement.prototype.getContext = (() => context) as never;

// Labels register Excalidraw's fonts; tests measure with the stub above, so loading is a no-op.
globalThis.FontFace = class {
  load() {
    return Promise.resolve(this);
  }
} as never;

export const unregisterDom = () => GlobalRegistrator.unregister();
