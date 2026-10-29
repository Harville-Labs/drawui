// Excalidraw reads `window` and `document` when it loads, so op tests run in happy-dom. Import this
// before anything that imports Excalidraw. Bun runs every test file in one process and loads each
// module once, so the DOM stays registered for the whole run instead of per file.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// happy-dom's networking globals enforce browser rules, and Bun's fetch rejects its AbortSignal.
// Canvas ops never touch the network, so server tests in the same run keep Bun's.
const NETWORK = [
  'fetch',
  'WebSocket',
  'AbortController',
  'AbortSignal',
  'Request',
  'Response',
  'Headers',
];
const native = NETWORK.map((name) => [name, Reflect.get(globalThis, name)] as const);
if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register({ url: 'http://localhost:4747/' });
for (const [name, value] of native) Reflect.set(globalThis, name, value);

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
