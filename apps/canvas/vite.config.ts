import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { shippedModules } from './scripts/shipped-modules.ts';

const server = 'http://127.0.0.1:4747';
// The server only answers its own origin, so the proxy presents itself as that origin.
const proxied = { target: server, changeOrigin: true, headers: { origin: server } };

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), shippedModules()],
  // Excalidraw checks this at runtime; Vite doesn't define process.env.
  define: { 'process.env.IS_PREACT': JSON.stringify('false') },
  server: {
    // `vite dev` for working on the canvas itself, against a drawui server already running.
    proxy: { '/ws': { ...proxied, ws: true }, '/mcp': proxied },
  },
});
