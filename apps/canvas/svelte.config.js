import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // The drawui server serves the build, so the canvas is a static single-page app.
    adapter: adapter({ fallback: 'index.html' }),
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        // Excalidraw subsets fonts with WebAssembly when exporting.
        'script-src': ['self', 'wasm-unsafe-eval'],
        'worker-src': ['self', 'blob:'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'blob:'],
        'font-src': ['self', 'data:'],
        'connect-src': ['self'],
        // The preview pane shows the user's own site, wherever it runs.
        'frame-src': ['http:', 'https:'],
        'frame-ancestors': ['none'],
        'form-action': ['none'],
        'base-uri': ['self'],
        'object-src': ['none'],
      },
    },
  },
};
