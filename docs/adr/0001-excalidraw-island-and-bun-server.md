# 1. Excalidraw in a SvelteKit app, served by a local Bun server

Status: accepted

## Context

drawui needs a freeform drawing canvas the user already knows how to use, a way for any MCP client to read and change the drawing, and a launch that is one command. The org standard for web apps is SvelteKit with Sivir UI.

## Decision

- **Excalidraw 0.18 as a React island** inside a SvelteKit page. It's the freeform canvas users asked for, its file format is open, and rebuilding it isn't worth it. React is only a dependency of that island.
- **adapter-static.** The canvas is a single-page app the server serves; it needs no server-side rendering.
- **One Bun process** serves the built canvas, a WebSocket for the canvas, and a stateless streamable-HTTP MCP endpoint on `127.0.0.1`. Stateless MCP means no session bookkeeping and works with every client; long waits (`wait_for_change`) hold one request open.
- **Agent edits run in the canvas tab**, not on the server, so they go through Excalidraw's element construction and the user's undo history.

## Consequences

- Drawing tools need a canvas tab open. The error says so and gives the URL.
- We depend on Excalidraw's `convertToExcalidrawElements` quirks and work around them in `ops.ts`; upgrades need the MCP drawing checks rerun.
- The canvas bundle is large (Excalidraw); it is served from disk, so that only matters on first load.
